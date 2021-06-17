/**
 * @name Query/googleShoppingFeed
 * @method
 * @memberof GoogleShoppingFeed/GraphQL
 * @summary resolver for the googleShoppingFeed GraphQL query
 * @param {Object} parentResult - unused
 * @param {Object} args - an object of all arguments that were sent by the client
 * @param {String} args.handle - The name of the feed
 * @param {String} args.shopUrl - The base URL of the shop
 * @param {Object} context - an object containing the per-request state
 * @param {Object} info Info about the GraphQL request
 * @returns {Promise<Object>|undefined} A Sitemap object (we use the Sitemap type from
 * @reactioncommerce/api-plugin-sitemap-generator as it has all the fields we need for a feed)
 */
export default async function googleShoppingFeed(parentResult, args, context) {
  const { handle, shopUrl } = args;

  return context.queries.googleShoppingFeed(context, {
    handle,
    shopUrl
  });
}
