export default [
    {
        type: 'function',
        function: {
            name: 'weather',
            description: 'Get current weather and forecast for any location',
            parameters: {
                type: 'object',
                properties: {
                    location: {
                        type: 'string',
                        description: 'City name or location for weather information'
                    }
                },
                required: ['location']
            }
        }
    }
    // Add other static tool definitions here if needed
];
