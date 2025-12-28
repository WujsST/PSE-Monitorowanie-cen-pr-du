/**
 * PSE API Client
 * Frontend client for communicating with the backend API server
 */

class PSEApiClient {
    constructor(baseURL = 'http://localhost:3001') {
        this.baseURL = baseURL;
        this.retryCount = 3;
        this.retryDelay = 1000;
    }

    /**
     * Generic fetch with retry logic
     */
    async fetchWithRetry(endpoint, options = {}, retriesLeft = this.retryCount) {
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            if (retriesLeft > 0) {
                console.warn(`Request failed, retrying... (${retriesLeft} attempts left)`);
                await this.delay(this.retryDelay);
                return this.fetchWithRetry(endpoint, options, retriesLeft - 1);
            }
            throw error;
        }
    }

    /**
     * Delay helper for retry logic
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get current energy prices
     */
    async getCurrentPrices() {
        try {
            const data = await this.fetchWithRetry('/api/current');
            return {
                success: true,
                data: data,
                cached: data.cached || false
            };
        } catch (error) {
            console.error('Error fetching current prices:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get historical data
     * @param {number} hours - Number of hours of history to fetch (24, 168, 720)
     */
    async getHistory(hours = 24) {
        try {
            const data = await this.fetchWithRetry(`/api/history?hours=${hours}`);
            return {
                success: true,
                data: data.data || [],
                cached: data.cached || false
            };
        } catch (error) {
            console.error('Error fetching history:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get statistics
     */
    async getStats() {
        try {
            const data = await this.fetchWithRetry('/api/stats');
            return {
                success: true,
                data: data,
                cached: data.cached || false
            };
        } catch (error) {
            console.error('Error fetching stats:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Check API health
     */
    async checkHealth() {
        try {
            const data = await this.fetchWithRetry('/api/health');
            return {
                success: true,
                data: data
            };
        } catch (error) {
            console.error('API health check failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Clear server cache
     */
    async clearCache() {
        try {
            await this.fetchWithRetry('/api/cache/clear', { method: 'POST' });
            return { success: true };
        } catch (error) {
            console.error('Error clearing cache:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Export for use in browser
if (typeof window !== 'undefined') {
    window.PSEApiClient = PSEApiClient;
}

// Export for Node.js/module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PSEApiClient;
}
