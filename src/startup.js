import generateGoogleShoppingFeedsJob from "./jobs/generate-google-shopping-feeds-job.js";
import getGoogleShoppingFeedRouteHandler from "./middleware/handle-google-shopping-feed-routes.js";

/**
 * @summary Called on startup
 * @param {Object} context Startup context
 * @param {Object} context.app The ReactionAPI instance
 * @param {Object} context.collections A map of MongoDB collections
 * @returns {undefined}
 */
export default async function googleShoppingFeedGeneratorStartup(context) {
  const { app } = context;

  // Setup feed generation recurring job
  await generateGoogleShoppingFeedsJob(context);

  // Wire up a file download route
  if (app.expressApp) {
    app.expressApp.use(getGoogleShoppingFeedRouteHandler(context));
  }
}
