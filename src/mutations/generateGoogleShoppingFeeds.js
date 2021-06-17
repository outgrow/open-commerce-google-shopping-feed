/**
 * @name feed/generateGoogleShoppingFeeds
 * @memberof Mutations/GoogleShoppingFeed
 * @method
 * @summary Regenerates feed files for primary shop
 * @param {Object} context - GraphQL execution context
 * @param {String} input Input of generateGoogleShoppingFeeds
 * @param {String} input.shopId Shop ID to generate feed for
 * @returns {undefined} schedules immediate feed generation job
 */
export default async function generateGoogleShoppingFeeds(context, input) {
  const { userId } = context;
  const { shopId } = input;

  await context.validatePermissions(`reaction:legacy:shops:${shopId}`, "update", { shopId });

  const jobOptions = {
    type: "googleShoppingFeeds/generate",
    data: { notifyUserId: userId, shopId }
  };

  // First cancel any existing job with same data. We can't use `cancelRepeats` option
  // on `scheduleJob` because that cancels all of that type, whereas we want to
  // cancel only those with the same type AND the same shopId and notify ID.
  await context.backgroundJobs.cancelJobs(jobOptions);

  await context.backgroundJobs.scheduleJob(jobOptions);
}
