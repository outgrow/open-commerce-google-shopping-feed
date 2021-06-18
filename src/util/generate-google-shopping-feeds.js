import SimpleSchema from "simpl-schema";
import Logger from "@reactioncommerce/logger";
import ReactionError from "@reactioncommerce/reaction-error";
import { stripHtml } from "string-strip-html";

/**
 * @name GoogleShoppingFeedsSchema
 * @memberof Schemas
 * @summary Schema for GoogleShoppingFeeds collection
 * @type {SimpleSchema}
 */
export const GoogleShoppingFeedsSchema = new SimpleSchema({
  shopId: String,
  handle: String,
  xml: String,
  createdAt: Date
});

/**
 * @name generateGoogleShoppingFeeds
 * @summary Generates & stores feed documents for one or more shops
 * @param {Object} context App context
 * @param {Object} options - Options
 * @param {Array} [options.shopIds] - _id of shops to generate feeds for. Defaults to primary shop _id
 * @param {String} [options.notifyUserId] - Optional user _id to notify via notifications UI
 * @returns {undefined}
 */
export default async function generateGoogleShoppingFeeds(context, { shopIds = [], notifyUserId = "" }) {
  Logger.debug("Generating Google Shopping feeds");
  const timeStart = new Date();

  // Add primary shop _id if none provided
  if (shopIds.length === 0) {
    throw new Error("generateGoogleShoppingFeeds requires shopIds list");
  }

  Logger.debug(`calling generateGoogleShoppingFeedsForShop with shopIds ${shopIds}`);

  // Generate feeds for each shop
  await Promise.all(shopIds.map((shopId) => generateGoogleShoppingFeedsForShop(context, shopId)));

  Logger.debug("done with generateGoogleShoppingFeedsForShop");
  // Notify user, if manually generated
  if (notifyUserId) {
    await context.mutations.createNotification(context, {
      accountId: notifyUserId,
      type: "googleShoppingFeedGenerated",
      message: "Google Shopping feed refresh is complete",
      url: "/google-shopping-feed.xml"
    });
  }

  const timeEnd = new Date();
  const timeDiff = timeEnd.getTime() - timeStart.getTime();
  Logger.debug(`Google Shopping feed generation complete. Took ${timeDiff}ms`);
}

/**
 * @name generateGoogleShoppingFeedsForShop
 * @private
 * @summary Creates and stores the Google Shopping feeds for a single shop, if any need to be regenerated,
 * meaning a product/tag has been updated, or a new custom URL is provided via the onGenerateGoogleShoppingFeed hook
 * @param {Object} context App context
 * @param {String} shopId - _id of shop to generate Google Shopping feeds for
 * @returns {undefined}
 */
async function generateGoogleShoppingFeedsForShop(context, shopId) {
  const { collections: { Catalog, Shipping, Shops, GoogleShoppingFeeds } } = context;

  Logger.debug("starting generateGoogleShoppingFeedsForShop");

  const shop = await Shops.findOne({ _id: shopId });
  if (!shop) {
    throw new ReactionError("not-found", `Shop ${shopId} not found`);
  }

  Logger.debug(`Generating feed for shop ${shop.name}`);

  const feedIndex = await GoogleShoppingFeeds.findOne({ shopId, handle: "google-shopping-feed.xml" });
  const hasNoFeed = !feedIndex;

  const selector = { updatedAt: { $gt: feedIndex && feedIndex.createdAt } };
  const options = { projection: { _id: 1 } };

  // Re-generate products in feed
  const shouldRegenProductGoogleShoppingFeeds = hasNoFeed || !!(await Catalog.findOne(selector, options));
  if (!shouldRegenProductGoogleShoppingFeeds) {
    Logger.debug("should NOT regen product feed");
    Logger.debug("feedIndex", feedIndex);
    Logger.debug("hasNoFeed", hasNoFeed);
    return;
  }

  Logger.debug("should regen product feed");

  const productFeedItems = await getProductFeedItems(context, shopId);

  Logger.debug("product feed items", productFeedItems);

  const availableShippingProviders = await Shipping.find({
    "shopId": shopId,
    "provider.enabled": true
  }).toArray();

  const { googleShoppingShippingCountry } = await context.queries.appSettings(context, shopId);

  // Regenerate feed index
  const newDoc = {
    shopId,
    xml: generateXML(productFeedItems, shop, availableShippingProviders, googleShoppingShippingCountry),
    handle: "google-shopping-feed.xml",
    createdAt: new Date()
  };

  Logger.debug("new feed document", newDoc);

  GoogleShoppingFeedsSchema.validate(newDoc);

  await GoogleShoppingFeeds.replaceOne({ shopId, handle: "google-shopping-feed.xml" }, newDoc, { upsert: true });
}

/**
 * @name getProductFeedItems
 * @private
 * @summary Loads visible products and returns an array of items to add to the products feed
 * @param {Object} context App context
 * @param {String} shopId - _id of shop to load products from
 * @returns {Object[]} - Array of objects w/ url & lastModDate properties
 */
async function getProductFeedItems(context, shopId) {
  const { collections: { Catalog } } = context;

  const products = await Catalog.find({
    shopId,
    "product.isVisible": true,
    "product.isDeleted": false
  }).toArray();

  return products.map(({ product }) => {
    const {
      _id,
      barcode,
      description,
      isSoldOut,
      media,
      pricing,
      primaryImage,
      sku,
      slug,
      supportedFulfillmentTypes,
      title,
      vendor
    } = product;

    const primaryImageUrl = primaryImage?.URLs?.large;

    return {
      _id,
      barcode,
      description: stripHtml(description).result,
      imageUrls: media.map((image) => image.URLs.large).filter((url) => url !== primaryImageUrl),
      primaryImageUrl,
      isSoldOut,
      price: pricing?.AED?.displayPrice,
      sku,
      supportedFulfillmentTypes,
      title,
      url: `BASE_URL/product/${slug}`,
      vendor
    };
  });
}

/**
 * @name generateXML
 * @summary Generates & returns XML for a feed index (doc that points to feeds)
 * @private
 * @param {Object[]} items - Array of items to add to feed index
 * @param {Object} shop - Shop object
 * @param {Object[]} availableShippingProviders - Available shipping methods
 * @param {Object[]} googleShoppingShippingCountry - The country to list the shipping rates for
 * @returns {String} - Generated XML
 */
function generateXML(items, shop, availableShippingProviders, googleShoppingShippingCountry) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
    <channel>
      <title>${shop.name}</title>
      <link>BASE_URL</link>
      <description>${shop.description}</description>`;

  Logger.debug("generateXML started");

  const availableShippingMethods = availableShippingProviders
    .reduce((methods, provider) => [...methods, ...provider.methods], [])
    .filter((method) => method.enabled);

  items.forEach((item) => {
    Logger.debug("generateXML item");

    const {
      _id,
      barcode,
      description,
      imageUrls,
      isSoldOut,
      price,
      primaryImageUrl,
      sku,
      supportedFulfillmentTypes,
      title,
      url,
      vendor
    } = item;

    const applicableShippingMethods = availableShippingMethods
      .filter((method) => supportedFulfillmentTypes.some((supportedFulfillmentType) =>
        method.fulfillmentTypes.includes(supportedFulfillmentType)));

    xml += `
      <item>
        <g:title>${title}</g:title>
        <g:link>${url}</g:link>
        <g:description>${description}</g:description>
        <g:image_link>MEDIA_BASE_URL${primaryImageUrl}</g:image_link>
        <g:price>${price}</g:price>
        <g:condition>new</g:condition>
        <g:id>${sku || _id}</g:id>
        ${sku && `<g:mpn>${sku}</g:mpn>`}
        ${barcode && `<g:gtin>${barcode}</g:gtin>`}
        ${vendor && `<g:brand>${vendor}</g:brand>`}
        <g:availability>${isSoldOut ? "out of stock" : "in stock"}</g:availability>
        ${imageUrls.map((imageUrl) => `<g:additional_image_link>MEDIA_BASE_URL${imageUrl}</g:additional_image_link>`)}
        ${applicableShippingMethods.map((method) => `
          <g:shipping>
            <g:country>${googleShoppingShippingCountry}</g:country>
            <g:service>${method.label}</g:service>
            <g:price>${method.rate}</g:price>
          </g:shipping>
        `)}
      </item>
    `;
  });

  xml += "\n</channel></rss>";

  Logger.debug("generateXML finish", xml);
  return xml;
}
