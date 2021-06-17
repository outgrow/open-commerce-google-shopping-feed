import generateGoogleShoppingFeeds from "../util/generate-google-shopping-feeds.js";
import updateGoogleShoppingFeedTaskForShop from "./updateGoogleShoppingFeedTaskForShop.js";

const jobType = "googleShoppingFeeds/generate";

/**
 * @name generateGoogleShoppingFeedsJob
 * @summary Initializes and processes a job that regenerates XML feeds
 * @param {Object} context App context
 * @returns {undefined}
 */
export default async function generateGoogleShoppingFeedsJob(context) {
  const { collections: { Shops } } = context;

  await context.backgroundJobs.addWorker({
    type: jobType,
    workTimeout: 180 * 1000,
    async worker(job) {
      const { notifyUserId = "", shopId } = job.data;

      try {
        await generateGoogleShoppingFeeds(context, { notifyUserId, shopIds: [shopId] });
        job.done(`${jobType} job done`, { repeatId: true });
      } catch (error) {
        job.fail(`Failed to generate Google Shopping feed. Error: ${error}`);
      }
    }
  });

  // Add one feed job per shop
  const shops = await Shops.find({}, { projection: { _id: 1, name: 1 } }).toArray();
  const promises = shops.map((shop) => updateGoogleShoppingFeedTaskForShop(context, shop._id));
  await Promise.all(promises);
}
