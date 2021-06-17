import { decodeShopOpaqueId } from "../../xforms/id.js";

/**
 * @name Mutation.generateGoogleShoppingFeeds
 * @method
 * @memberof GoogleShoppingFeed/GraphQL
 * @summary resolver for the generateGoogleShoppingFeeds GraphQL mutation
 * @param {Object} parentResult - unused
 * @param {Object} args.input An object of all mutation arguments that were sent by the client
 * @param {String} args.input.shopId shopId to generate feed for
 * @param {String} [args.input.clientMutationId] An optional string identifying the mutation call
 * @param {Object} context - an object containing the per-request state
 * @returns {Promise<Boolean>} true on success
 */
export default async function generateGoogleShoppingFeeds(parentResult, { input = {} }, context) {
  const { clientMutationId = null, shopId: opaqueShopId } = input;

  const shopId = decodeShopOpaqueId(opaqueShopId);

  await context.mutations.generateGoogleShoppingFeeds(context, { shopId });

  return {
    wasJobScheduled: true,
    clientMutationId
  };
}
