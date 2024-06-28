module.exports = {
    getContributionCreatedEvents: async function(CSPlatform) {
        try {
            const filter = CSPlatform.filters.ContributionCreated;
            return await CSPlatform.queryFilter(filter);
        } catch (e) {
            console.log('Failed to get event:', e);
        }
    },


    getContributionAssignedEvents: async function(CSPlatform) {
        try {
            const filter = CSPlatform.filters.ContributionAssigned;
            return await CSPlatform.queryFilter(filter);
        } catch (e) {
            console.log('Failed to get event:', e);
        }
    },


    getCoordinateUpdatedEvents: async function(CSPlatform) {
        try {
            const filter = CSPlatform.filters.CoordinateUpdated;
            return await CSPlatform.queryFilter(filter);
        } catch (e) {
            console.log('Failed to get event:', e);
        }
    },


    getContributionReviewedEvents: async function(CSPlatform, result=NaN) {
        try {
            const filter = CSPlatform.filters.ContributionReviewed;
            const events = await CSPlatform.queryFilter(filter);
            if (result >= 0 && result <= 2) {
                return events.filter(event => Number(event.args.result) === result);
            } else if (isNaN(result)) {
                return events;
            } else {
                return [];
            }
        } catch (e) {
            console.log('Failed to get event:', e);
        }
    },


    getVerifierUpdatedEvents: async function(CSPlatform) {
        try {
            const filter = CSPlatform.filters.VerifierUpdated;
            return await CSPlatform.queryFilter(filter);
        } catch (e) {
            console.log('Failed to get event:', e);
        }
    }
};
