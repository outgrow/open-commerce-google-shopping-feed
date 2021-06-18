/**
 * @name googleShoppingFeedQuery
 * @method
 * @summary Retrieves a Google Shopping feed object given a handle and shopUrl
 * @param {Object} context - an object containing the per-request state
 * @param {String} handle - Google Shopping feed's handle, as set in GoogleShoppingFeeds collection
 * @param {String} shopUrl - URL of the shop the feed belongs to. The URL is used to find the shop with the domain of the URL
 * @returns {String} - Google Shopping feed object containing XML with placeholders replaced (BASE_URL, LAST_MOD)
 */
export default async function googleShoppingFeedQuery(context, { handle, shopUrl }) {
  const { GoogleShoppingFeeds, Shops } = context.collections;
  const { rootUrl: apiUrl } = context;
  const storefrontDomain = new URL(shopUrl.trim()).hostname;
  const trimmedHandle = handle.trim();

  // ensure the domain requested is for a known shop domain
  const { _id: shopId } = await Shops.findOne({ domains: storefrontDomain }) || {};

  if (!shopId) return null;

  const googleShoppingFeed = await GoogleShoppingFeeds.findOne({ shopId, handle: trimmedHandle });

  if (!googleShoppingFeed) return null;

  googleShoppingFeed.xml = googleShoppingFeed.xml
    .replace(/BASE_URL/g, shopUrl)
    .replace(/MEDIA_BASE_URL/g, apiUrl);

  return googleShoppingFeed;
}
