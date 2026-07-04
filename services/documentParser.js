const pdf = require('pdf-parse');
const axios = require('axios');
const mammoth = require('mammoth');
const xlsx = require('xlsx');

class DocumentParserService {
    constructor() {
        this.hereApiKey = process.env.HERE_API_KEY;
    }

    /**
     * Parse document buffer and extract order data
     * @param {Buffer} buffer - File buffer
     * @param {string} originalname - Original file name (for extension)
     * @returns {Array} Array of parsed orders
     */
    async parseDocument(buffer, originalname) {
        try {
            const ext = originalname.split('.').pop().toLowerCase();
            let orders = [];

            if (ext === 'pdf') {
                const data = await pdf(buffer);
                orders = this.extractOrdersFromText(data.text);
            } else if (ext === 'docx') {
                const result = await mammoth.extractRawText({ buffer: buffer });
                orders = this.extractOrdersFromText(result.value);
            } else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
                orders = this.parseSpreadsheet(buffer);
            } else if (ext === 'txt') {
                orders = this.extractOrdersFromText(buffer.toString('utf-8'));
            } else {
                throw new Error('Unsupported file format. Please use PDF, DOCX, XLSX, CSV, or TXT.');
            }
            
            // Geocode addresses for each order (handles Google Maps links inside geocodeOrders)
            const ordersWithCoordinates = await this.geocodeOrders(orders);
            
            // Clean up internal properties that aren't in Supabase schema
            return ordersWithCoordinates.map(order => {
                const { google_maps_url, ...cleanOrder } = order;
                return cleanOrder;
            });
        } catch (error) {
            console.error('Error parsing document:', error);
            throw new Error('Failed to parse document: ' + error.message);
        }
    }

    /**
     * Parse spreadsheet data (XLSX/CSV)
     * @param {Buffer} buffer - File buffer
     * @returns {Array} Array of order objects
     */
    parseSpreadsheet(buffer) {
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);
        
        const orders = [];
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            
            // Find columns fuzzily
            const nameKey = Object.keys(row).find(k => k.toLowerCase().includes('name')) || Object.keys(row)[0];
            const phoneKey = Object.keys(row).find(k => k.toLowerCase().includes('phone') || k.toLowerCase().includes('mobile'));
            const addressKey = Object.keys(row).find(k => k.toLowerCase().includes('address') || k.toLowerCase().includes('location'));
            const cityKey = Object.keys(row).find(k => k.toLowerCase().includes('city'));
            const linkKey = Object.keys(row).find(k => k.toLowerCase().includes('link') || k.toLowerCase().includes('map') || k.toLowerCase().includes('url'));
            
            if (!row[nameKey]) continue;

            const order = {
                customer_name: String(row[nameKey]),
                customer_email: `customer${i + 1}@email.com`,
                customer_phone: phoneKey ? String(row[phoneKey]) : `01925${String(100000 + i).slice(1)}`,
                delivery_address: addressKey ? String(row[addressKey]) : 'Address to be confirmed',
                city: cityKey ? String(row[cityKey]) : 'Warrington',
                postcode: 'WA4 1EF',
                order_value: 50.00,
                weight: 2.5,
                delivery_date: new Date().toISOString().split('T')[0],
                status: 'pending'
            };
            
            if (linkKey && row[linkKey]) {
                order.google_maps_url = String(row[linkKey]);
            }

            orders.push(order);
        }
        return orders;
    }

    /**
     * Parses the highly structured format sent by ManualOrderForm.jsx
     */
    parseManualOrdersText(text) {
        const orders = [];
        const orderBlocks = text.split(/Order \d+:/).filter(b => b.trim().length > 0);
        
        for (let i = 0; i < orderBlocks.length; i++) {
            const block = orderBlocks[i].trim();
            const lines = block.split('\n').map(l => l.trim());
            
            const order = {
                customer_name: `Customer ${i + 1}`,
                customer_email: `customer${i + 1}@email.com`,
                customer_phone: `0000000000`,
                delivery_address: '',
                city: '',
                postcode: '',
                latitude: null,
                longitude: null,
                google_maps_url: '',
                order_value: 50.00,
                weight: 2.5,
                delivery_date: new Date().toISOString().split('T')[0],
                status: 'pending'
            };

            for (const line of lines) {
                if (line.startsWith('Name:') || line.startsWith('Customer:')) order.customer_name = line.replace(/Name:|Customer:/, '').trim() || order.customer_name;
                if (line.startsWith('Phone:')) order.customer_phone = line.replace('Phone:', '').trim() || order.customer_phone;
                if (line.startsWith('Address:')) order.delivery_address = line.replace('Address:', '').trim();
                if (line.startsWith('City:')) order.city = line.replace('City:', '').trim();
                if (line.startsWith('Link:')) order.google_maps_url = line.replace('Link:', '').trim();
                if (line.startsWith('Latitude:')) order.latitude = parseFloat(line.replace('Latitude:', '').trim());
                if (line.startsWith('Longitude:')) order.longitude = parseFloat(line.replace('Longitude:', '').trim());
                if (line.startsWith('Coordinates:')) {
                    const coords = line.replace('Coordinates:', '').trim().split(',');
                    if (coords.length === 2) {
                        order.latitude = parseFloat(coords[0].trim());
                        order.longitude = parseFloat(coords[1].trim());
                    }
                }
            }
            
            orders.push(order);
        }
        
        console.log(`Extracted ${orders.length} orders using Manual Form parser`);
        return orders;
    }

    /**
     * Extract orders from raw text (handles various formats)
     * @param {string} text - Raw text
     * @returns {Array} Array of order objects
     */
    extractOrdersFromText(text) {
        // First check if this is our structured Manual Form format
        if (text.includes('Order 1:') && (text.includes('Name:') || text.includes('Customer:')) && text.includes('Address:')) {
            return this.parseManualOrdersText(text);
        }

        const orders = [];
        
        // Split text into lines and clean up
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        // Common patterns for order data extraction
        const patterns = {
            // Match customer names (typically at start of line, capitalized)
            customerName: /^([A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
            
            // Match UK postcodes
            postcode: /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})\b/i,
            
            // Match email addresses
            email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
            
            // Match phone numbers (UK format)
            phone: /\b(?:0\d{4}\s?\d{6}|0\d{3}\s?\d{3}\s?\d{4}|07\d{3}\s?\d{6})\b/,
            
            // Match addresses (lines containing numbers and common address words)
            address: /\d+\s+[A-Za-z\s]+(road|street|avenue|lane|grove|close|way|drive|place|crescent|terrace|gardens|park|square|court)\b/i,
            
            // Match order values (£ symbol followed by number)
            orderValue: /£(\d+(?:\.\d{2})?)/,
            
            // Match weights (kg or g)
            weight: /(\d+(?:\.\d+)?)\s*(?:kg|g)\b/i,
            
            // Match latitude (decimal degrees)
            latitude: /(?:lat(?:itude)?[:\s]*)?(-?\d+\.\d+)/i,
            
            // Match longitude (decimal degrees)
            longitude: /(?:lon(?:g|gitude)?[:\s]*)?(-?\d+\.\d+)/i,

            // Match Google Maps links
            googleMapsLink: /(https?:\/\/(?:www\.)?google\.com\/maps[^\s]+|https?:\/\/maps\.app\.goo\.gl\/[^\s]+)/i
        };

        let currentOrder = {};
        let orderIndex = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Check for customer name (usually starts a new order)
            const nameMatch = line.match(patterns.customerName);
            if (nameMatch && !line.includes('@') && !line.includes('£')) {
                // Save previous order if exists
                if (Object.keys(currentOrder).length > 0) {
                    orders.push(this.validateAndFormatOrder(currentOrder, orderIndex));
                    orderIndex++;
                }
                
                // Start new order
                currentOrder = {
                    customer_name: nameMatch[1],
                    customer_email: `customer${orderIndex + 1}@email.com`, // Default email
                    customer_phone: `01925${String(100000 + orderIndex).slice(1)}`, // Default phone
                    order_value: 50.00, // Default value
                    weight: 2.5, // Default weight
                    delivery_date: new Date().toISOString().split('T')[0],
                    status: 'pending'
                };
            }
            
            // Extract email
            const emailMatch = line.match(patterns.email);
            if (emailMatch && currentOrder.customer_name) {
                currentOrder.customer_email = emailMatch[0];
            }
            
            // Extract phone
            const phoneMatch = line.match(patterns.phone);
            if (phoneMatch && currentOrder.customer_name) {
                currentOrder.customer_phone = phoneMatch[0];
            }
            
            // Extract address
            const addressMatch = line.match(patterns.address);
            if (addressMatch && currentOrder.customer_name) {
                currentOrder.delivery_address = line;
                
                // Extract postcode from same line or nearby lines
                const postcodeMatch = line.match(patterns.postcode);
                if (postcodeMatch) {
                    currentOrder.postcode = postcodeMatch[1].toUpperCase();
                    currentOrder.city = this.extractCityFromPostcode(currentOrder.postcode);
                }
            }
            
            // Extract postcode if not found with address
            if (!currentOrder.postcode) {
                const postcodeMatch = line.match(patterns.postcode);
                if (postcodeMatch && currentOrder.customer_name) {
                    currentOrder.postcode = postcodeMatch[1].toUpperCase();
                    currentOrder.city = this.extractCityFromPostcode(currentOrder.postcode);
                }
            }
            
            // Extract latitude
            const latMatch = line.match(patterns.latitude);
            if (latMatch && currentOrder.customer_name && !currentOrder.latitude) {
                const lat = parseFloat(latMatch[1]);
                if (lat >= 50 && lat <= 60) { // Reasonable UK latitude range
                    currentOrder.latitude = lat;
                }
            }
            
            // Extract longitude  
            const lngMatch = line.match(patterns.longitude);
            if (lngMatch && currentOrder.customer_name && !currentOrder.longitude) {
                const lng = parseFloat(lngMatch[1]);
                if (lng >= -8 && lng <= 2) { // Reasonable UK longitude range
                    currentOrder.longitude = lng;
                }
            }
            
            // Extract order value
            const valueMatch = line.match(patterns.orderValue);
            if (valueMatch && currentOrder.customer_name) {
                currentOrder.order_value = parseFloat(valueMatch[1]);
            }
            
            // Extract weight
            const weightMatch = line.match(patterns.weight);
            if (weightMatch && currentOrder.customer_name) {
                let weight = parseFloat(weightMatch[1]);
                // Convert grams to kg if necessary
                if (line.toLowerCase().includes('g') && !line.toLowerCase().includes('kg')) {
                    weight = weight / 1000;
                }
                currentOrder.weight = weight;
            }

            // Extract Google Maps Link
            const mapLinkMatch = line.match(patterns.googleMapsLink);
            if (mapLinkMatch && currentOrder.customer_name) {
                currentOrder.google_maps_url = mapLinkMatch[0];
            }
        }
        
        // Add the last order
        if (Object.keys(currentOrder).length > 0) {
            orders.push(this.validateAndFormatOrder(currentOrder, orderIndex));
        }
        
        // If no structured data found, try alternative parsing methods
        if (orders.length === 0) {
            return this.fallbackParsing(text);
        }
        
        console.log(`Extracted ${orders.length} orders from PDF`);
        return orders;
    }

    /**
     * Fallback parsing for different PDF formats
     * @param {string} text - Raw text from PDF
     * @returns {Array} Array of order objects
     */
    fallbackParsing(text) {
        console.log('Using fallback parsing method');
        
        // Try to split by common delimiters
        const sections = text.split(/\n\s*\n|\t\t+|,\s*(?=[A-Z][a-z]+ [A-Z])/);
        const orders = [];
        
        for (let i = 0; i < sections.length; i++) {
            const section = sections[i].trim();
            if (section.length < 10) continue; // Skip short sections
            
            const order = {
                customer_name: `Customer ${i + 1}`,
                customer_email: `customer${i + 1}@email.com`,
                customer_phone: `01925${String(100000 + i).slice(1)}`,
                delivery_address: section,
                postcode: '', 
                city: '',
                order_value: 50.00,
                weight: 2.5,
                delivery_date: new Date().toISOString().split('T')[0],
                status: 'pending'
            };
            
            // Try to extract postcode from section
            const postcodeMatch = section.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})\b/i);
            if (postcodeMatch) {
                order.postcode = postcodeMatch[1].toUpperCase();
                order.city = this.extractCityFromPostcode(order.postcode);
            }
            
            orders.push(order);
        }
        
        return orders;
    }

    /**
     * Validate and format order data
     * @param {Object} order - Raw order object
     * @param {number} index - Order index for defaults
     * @returns {Object} Formatted order object
     */
    validateAndFormatOrder(order, index) {
        return {
            customer_name: order.customer_name || `Customer ${index + 1}`,
            customer_email: order.customer_email || `customer${index + 1}@email.com`,
            customer_phone: order.customer_phone || `01925${String(100000 + index).slice(1)}`,
            delivery_address: order.delivery_address || 'Address to be confirmed',
            postcode: order.postcode || 'WA4 1EF',
            city: order.city || 'Warrington',
            order_value: order.order_value || 50.00,
            weight: order.weight || 2.5,
            delivery_date: order.delivery_date || new Date().toISOString().split('T')[0],
            status: 'pending'
        };
    }

    /**
     * Extract city from postcode
     * @param {string} postcode - UK postcode
     * @returns {string} City name
     */
    extractCityFromPostcode(postcode) {
        const prefix = postcode.substring(0, 2).toUpperCase();
        
        const postcodeToCity = {
            'WA': 'Warrington',
            'CH': 'Chester',
            'M1': 'Manchester',
            'M2': 'Manchester',
            'L1': 'Liverpool',
            'L2': 'Liverpool',
            'SK': 'Stockport',
            'WN': 'Wigan'
        };
        
        return postcodeToCity[prefix] || 'Warrington'; // Default to Warrington
    }

    /**
     * Geocode addresses using HERE API (only if coordinates not provided)
     * @param {Array} orders - Array of orders
     * @returns {Array} Orders with latitude and longitude
     */
    async geocodeOrders(orders) {
        const geocodedOrders = [];
        
        for (const order of orders) {
            try {
                // First, check if there's a Google Maps URL we can extract coordinates from
                if (order.google_maps_url && (!order.latitude || !order.longitude)) {
                    try {
                        const coords = await this.extractCoordsFromMapUrl(order.google_maps_url);
                        if (coords) {
                            order.latitude = coords.lat;
                            order.longitude = coords.lng;
                            console.log(`Extracted coordinates from Map URL for ${order.customer_name}: ${order.latitude}, ${order.longitude}`);
                        }
                    } catch (e) {
                        console.warn(`Failed to parse map URL for ${order.customer_name}:`, e.message);
                    }
                }

                // Skip geocoding if coordinates are already provided or extracted
                if (order.latitude && order.longitude) {
                    console.log(`Coordinates already provided for ${order.customer_name}: ${order.latitude}, ${order.longitude}`);
                    geocodedOrders.push(order);
                    continue;
                }
                
                // Only geocode if coordinates are missing
                const addressParts = [order.delivery_address, order.city, order.postcode].filter(p => p && p.trim() !== '');
                const address = addressParts.join(', ');
                const coordinates = await this.geocodeAddress(address);
                
                geocodedOrders.push({
                    ...order,
                    latitude: coordinates.lat,
                    longitude: coordinates.lng
                });
                
                // Add delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`Failed to geocode address for ${order.customer_name}:`, error.message);
                
                // Use default Warrington coordinates if geocoding fails
                geocodedOrders.push({
                    ...order,
                    latitude: order.latitude || null,
                    longitude: order.longitude || null
                });
            }
        }
        
        return geocodedOrders;
    }

    /**
     * Extract coordinates from Google Maps URL (including short links)
     * @param {string} url - Google Maps URL
     * @returns {Object|null} Coordinates {lat, lng} or null
     */
    async extractCoordsFromMapUrl(url) {
        let fullUrl = url;
        
        // Expand short link
        if (url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')) {
            try {
                const response = await axios.get(url, {
                    maxRedirects: 5,
                    validateStatus: function (status) {
                        return status >= 200 && status < 400; // Resolve redirects
                    }
                });
                fullUrl = response.request.res.responseUrl || fullUrl;
            } catch (error) {
                console.warn('Failed to expand shortlink:', error.message);
            }
        }
        
        // Parse the full URL for coordinates
        const tight = fullUrl.replace(/\s/g, '');
        // !3d.!4d. - actual place pin
        let m = tight.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/i);
        if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
        
        // @lat,lng - map view center
        m = tight.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)(?:,|\s|\/|\?|#|z|\]|$)/);
        if (!m) m = tight.match(/@(-?\d+\.?\d*),(-?\d+\.?\d+)/);
        if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
        
        m = tight.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)\b/);
        if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
        
        m = tight.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)\b/);
        if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };

        return null;
    }

    /**
     * Geocode a single address using HERE API with a free Nominatim fallback
     * @param {string} address - Full address string
     * @returns {Object} Coordinates {lat, lng}
     */
    async geocodeAddress(address) {
        // Try HERE API first if configured
        if (this.hereApiKey) {
            try {
                const encodedAddress = encodeURIComponent(address);
                const url = `https://geocode.search.hereapi.com/v1/geocode?q=${encodedAddress}&apikey=${this.hereApiKey}`;
                
                const response = await axios.get(url);
                
                if (response.data.items && response.data.items.length > 0) {
                    const location = response.data.items[0].position;
                    return {
                        lat: location.lat,
                        lng: location.lng
                    };
                }
            } catch (error) {
                console.warn('HERE API geocoding failed, falling back to Nominatim...', error.message);
            }
        }
        
        // Fallback to free Nominatim API
        try {
            console.log(`Using free Nominatim API to geocode: ${address}`);
            const encoded = encodeURIComponent(address);
            const response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1`, {
                headers: { 'User-Agent': 'xRuto/1.0' } // Nominatim requires a User-Agent
            });
            
            if (response.data && response.data.length > 0) {
                return {
                    lat: parseFloat(response.data[0].lat),
                    lng: parseFloat(response.data[0].lon)
                };
            }
            throw new Error('No geocoding results found from Nominatim either');
        } catch (error) {
            console.error('Geocoding error:', error.message);
            throw error;
        }
    }

    /**
     * Generate sample orders for testing (matching Supabase format)
     * @param {number} count - Number of sample orders to generate
     * @returns {Array} Array of sample orders
     */
    generateSampleOrders(count = 5) {
        const orders = [];
        const sampleData = [
            {
                name: 'John Smith',
                email: 'john.smith0@email.com',
                phone: '01925100000',
                address: '13 Ash Grove, Latchford, Warrington WA4 1EF, UK',
                postcode: 'WA4 1EF',
                city: 'Latchford',
                lat: 53.3807489,
                lng: -2.5751915,
                value: 45.99,
                weight: 2.5
            },
            {
                name: 'Sarah Wilson',
                email: 'sarah.wilson1@email.com',
                phone: '01925100001',
                address: '13 Myrtle Grove, Latchford, Warrington WA4 1EE, UK',
                postcode: 'WA4 1EE',
                city: 'Latchford',
                lat: 53.3811877,
                lng: -2.5748538,
                value: 67.80,
                weight: 3.2
            },
            {
                name: 'Mike Johnson',
                email: 'mike.johnson2@email.com',
                phone: '01925100002',
                address: '32 Park Ave, Warrington WA4 1DZ, UK',
                postcode: 'WA4 1DZ',
                city: 'Warrington',
                lat: 53.38065109999999,
                lng: -2.5763532,
                value: 52.30,
                weight: 2.8
            },
            {
                name: 'Emma Davis',
                email: 'emma.davis3@email.com',
                phone: '01925100003',
                address: '16 Myrtle Grove, Latchford, Warrington WA4 1EE, UK',
                postcode: 'WA4 1EE',
                city: 'Latchford',
                lat: 53.3810677,
                lng: -2.5743999,
                value: 78.45,
                weight: 3.9
            },
            {
                name: 'Tom Brown',
                email: 'tom.brown4@email.com',
                phone: '01925100004',
                address: '17 Myrtle Grove, Latchford, Warrington WA4 1EE, UK',
                postcode: 'WA4 1EE',
                city: 'Latchford',
                lat: 53.3810082,
                lng: -2.5742814,
                value: 41.20,
                weight: 2.1
            }
        ];
        
        for (let i = 0; i < Math.min(count, sampleData.length); i++) {
            const sample = sampleData[i];
            orders.push({
                customer_name: sample.name,
                customer_email: sample.email,
                customer_phone: sample.phone,
                delivery_address: sample.address,
                postcode: sample.postcode,
                city: sample.city,
                latitude: sample.lat,
                longitude: sample.lng,
                order_value: sample.value,
                weight: sample.weight,
                delivery_date: new Date().toISOString().split('T')[0],
                status: 'pending'
            });
        }
        
        return orders;
    }
}

module.exports = DocumentParserService;