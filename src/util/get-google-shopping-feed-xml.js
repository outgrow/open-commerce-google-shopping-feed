/**
 * @name getGoogleShoppingFeedXML
 * @summary Loads and returns the XML for one of a shop's Google Shopping feeds
 * @param {Object} context App context
 * @param {String} shopId - _id of shop feed belongs to
 * @param {String} handle - The feed's handle, as set in GoogleShoppingFeeds collection
 * @returns {String} - XML
 */
export default async function getGoogleShoppingFeedXML(context, shopId, handle) {
  const { collections: { GoogleShoppingFeeds } } = context;

  const feed = await GoogleShoppingFeeds.findOne({ shopId, handle });
  if (!feed) return "";

  return feed.xml;
}
