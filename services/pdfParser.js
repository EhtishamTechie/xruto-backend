const pdf = require('pdf-parse');
const axios = require('axios');

class PDFParserService {
    constructor() {
        this.hereApiKey = process.env.HERE_API_KEY;
    }

    /**
     * Parse PDF buffer and extract order data
     * @param {Buffer} pdfBuffer - PDF file buffer
     * @returns {Array} Array of parsed orders
     */
    async parsePDF(pdfBuffer) {
        try {
            const data = await pdf(pdfBuffer);
            const text = data.text;
            
            console.log('PDF Text Content:', text);
            
            // Parse the text based on common order patterns
            const orders = this.extractOrdersFromText(text);
            
            // Geocode addresses for each order
            const ordersWithCoordinates = await this.geocodeOrders(orders);
            
            return ordersWithCoordinates;
        } catch (error) {
            console.error('Error parsing PDF:', error);
            throw new Error('Failed to parse PDF: ' + error.message);
        }
    }

    /**
     * Extract order information from PDF text
     * @param {string} text - Raw text from PDF
     * @returns {Array} Array of order objects
     */
    extractOrdersFromText(text) {
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
            longitude: /(?:lon(?:g|gitude)?[:\s]*)?(-?\d+\.\d+)/i
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
                postcode: 'WA4 1EF', // Default Warrington postcode
                city: 'Warrington',
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
                // Skip geocoding if coordinates are already provided
                if (order.latitude && order.longitude) {
                    console.log(`Coordinates already provided for ${order.customer_name}: ${order.latitude}, ${order.longitude}`);
                    geocodedOrders.push(order);
                    continue;
                }
                
                // Only geocode if coordinates are missing
                const address = `${order.delivery_address}, ${order.city}, ${order.postcode}, UK`;
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
                    latitude: order.latitude || 53.3900,
                    longitude: order.longitude || -2.5970
                });
            }
        }
        
        return geocodedOrders;
    }

    /**
     * Geocode a single address using HERE API
     * @param {string} address - Full address string
     * @returns {Object} Coordinates {lat, lng}
     */
    async geocodeAddress(address) {
        if (!this.hereApiKey) {
            throw new Error('HERE API key not configured');
        }
        
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
            } else {
                throw new Error('No geocoding results found');
            }
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

module.exports = PDFParserService;