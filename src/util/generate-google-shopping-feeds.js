import SimpleSchema from "simpl-schema";
import Logger from "@reactioncommerce/logger";
import ReactionError from "@reactioncommerce/reaction-error";
import entities from "entities";
import { stripHtml } from "string-strip-html";
import findDeepestVariants from "./find-deepest-variants.js";
import { encodeCatalogProductVariantOpaqueId } from "../xforms/id.js";

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

function variantAttribute(variant) {
  const attributeLabel = variant?.attributeLabel.toLowerCase();

  if (["size", "color", "pattern", "material", "gender"].includes(attributeLabel)) {
    return {
      [attributeLabel]: entities.encodeXML(variant.optionTitle)
    };
  }

  return {};
}

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

  // Logger.debug("product feed items", productFeedItems);

  const availableShippingProviders = await Shipping.find({
    "shopId": shopId,
    "provider.enabled": true
  }).toArray();

  const { googleShoppingShippingCountry } = await context.queries.appSettings(context, shopId);

  // Regenerate feed index
  const newDoc = {
    shopId,
    xml: generateXML(productFeedItems.flat(), shop, availableShippingProviders, googleShoppingShippingCountry),
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

    const firstFoundCurrency = Object.keys(pricing)[0];
    const firstFoundCurrencyPricing = pricing[firstFoundCurrency];

    const deepestVariants = findDeepestVariants(product);

    Logger.debug("deepestVariants", deepestVariants);

    const transformedDeepestVariants = deepestVariants.map((variant) => {
      const variantPrimaryImageUrl = variant.primaryImage?.URLs?.large;
      const variantFirstFoundCurrency = Object.keys(variant.pricing)[0];
      const variantFirstFoundCurrencyPricing = variant.pricing[variantFirstFoundCurrency];

      return {
        _id: entities.encodeXML(variant._id),
        barcode: barcode ? entities.encodeXML(variant.barcode) : null,
        currency: variantFirstFoundCurrency,
        description: description ? entities.encodeXML(stripHtml(description).result) : null, // strip out potential HTML tags
        itemGroupId: sku ? entities.encodeXML(sku) : entities.encodeXML(_id),
        title: variant.title ? entities.encodeXML(variant.title) : null,
        imageUrls: variant.media.map((image) => image.URLs.large).filter((url) => url !== variantPrimaryImageUrl).slice(0, 10),
        primaryImageUrl: variantPrimaryImageUrl ? variantPrimaryImageUrl : primaryImageUrl,
        isSoldOut: variant.isSoldOut,
        price: `${variantFirstFoundCurrencyPricing?.price ? variantFirstFoundCurrencyPricing?.price : variantFirstFoundCurrencyPricing?.minPrice} ${variantFirstFoundCurrency}`,
        sku: variant.sku ? entities.encodeXML(variant.sku) : null,
        supportedFulfillmentTypes,
        url: `BASE_URL/product/${slug}/${encodeCatalogProductVariantOpaqueId(variant._id)}`,
        vendor: vendor ? entities.encodeXML(vendor) : null,
        variantAttributes: variantAttribute(variant)
      }
    });

    return [
      {
        _id: entities.encodeXML(_id),
        barcode: barcode ? entities.encodeXML(barcode) : null,
        currency: firstFoundCurrency,
        description: description ? entities.encodeXML(stripHtml(description).result) : null, // strip out potential HTML tags
        imageUrls: media.map((image) => image.URLs.large).filter((url) => url !== primaryImageUrl).slice(0, 10),
        primaryImageUrl,
        isSoldOut,
        price: `${firstFoundCurrencyPricing?.minPrice ? firstFoundCurrencyPricing?.minPrice : firstFoundCurrencyPricing?.price} ${firstFoundCurrency}`,
        sku: sku ? entities.encodeXML(sku) : entities.encodeXML(_id),
        supportedFulfillmentTypes,
        title: title ? entities.encodeXML(title) : null,
        url: `BASE_URL/product/${slug}`,
        vendor: vendor ? entities.encodeXML(vendor) : null
      },
      ...transformedDeepestVariants
    ];
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
  let shopNameTag = "";
  let shopDescriptionTag = "";

  if (shop.name) {
    shopNameTag = `<title>${entities.encodeXML(shop.name)}</title>`;
  }

  if (shop.description) {
    shopDescriptionTag = `<description>${entities.encodeXML(shop.description)}</description>`;
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
    <channel>
      ${shopNameTag}
      <link>BASE_URL</link>
      ${shopDescriptionTag}
  `;

  Logger.debug("generateXML started");

  const availableShippingMethods = availableShippingProviders
    .reduce((methods, provider) => [...methods, ...provider.methods], [])
    .filter((method) => method.enabled);

  items.forEach((item) => {
    Logger.debug("generateXML item");

    const {
      _id,
      barcode,
      currency,
      description,
      imageUrls,
      isSoldOut,
      itemGroupId,
      price,
      primaryImageUrl,
      sku,
      supportedFulfillmentTypes,
      title,
      url,
      variantAttributes,
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
        ${primaryImageUrl ? `<g:image_link>MEDIA_URL${primaryImageUrl}</g:image_link>` : ""}
        <g:price>${price}</g:price>
        <g:condition>new</g:condition>
        <g:id>${sku || _id}</g:id>
        ${sku ? `<g:mpn>${sku}</g:mpn>` : ""}
        ${barcode ? `<g:gtin>${barcode}</g:gtin>` : ""}
        ${vendor ? `<g:brand>${vendor}</g:brand>` : ""}
        <g:availability>${isSoldOut ? "out of stock" : "in stock"}</g:availability>
        ${imageUrls.map((imageUrl) => `<g:additional_image_link>MEDIA_URL${imageUrl}</g:additional_image_link>`)}
        ${applicableShippingMethods.map((method) => `<g:shipping>
          <g:country>${googleShoppingShippingCountry}</g:country>
          <g:service>${entities.encodeXML(method.label)}</g:service>
          <g:price>${method.rate} ${currency}</g:price>
        </g:shipping>`)}
        ${itemGroupId ? `<g:item_group_id>${itemGroupId}</g:item_group_id>` : ""}
        ${variantAttributes ? Object.keys(variantAttributes).map((variantAttribute) => `<g:${variantAttribute}>
          ${variantAttributes[variantAttribute]}
        </g:${variantAttribute}>`) : ""}
      </item>
    `;
  });

  xml += "\n</channel></rss>";

  // Logger.debug("generateXML finish", xml);
  return xml;
}
