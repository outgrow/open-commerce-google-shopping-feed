import SimpleSchema from "simpl-schema";

/**
 * @name Sitemap
 * @type {SimpleSchema}
 * @memberof Schemas
 * @property {String} _id of feed
 * @property {Date} createdAt date at which this feed was created
 * @property {String} handle the name of the feed xml file
 * @property {String} shopId the shop to which this feed belongs to.
 * @property {String} xml the feed in XML format
 */
export const Sitemap = new SimpleSchema({
  _id: String,
  createdAt: Date,
  handle: {
    type: String
  },
  shopId: {
    type: String
  },
  xml: {
    type: String
  }
});
