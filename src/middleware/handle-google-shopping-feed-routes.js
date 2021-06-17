import getGoogleShoppingFeedXML from "../util/get-google-shopping-feed-xml.js";

/**
 * @name getGoogleShoppingFeedRouteHandler
 * @summary Returns a route handler/middleware for generated feed XML files
 * @param {Object} context App context
 * @returns {Function} Handler function
 */
export default function getGoogleShoppingFeedRouteHandler(context) {
  const { collections: { Shops } } = context;

  /**
   * @name handleGoogleShoppingFeedRoutes
   * @summary Route handler/middleware for generated feed XML files
   * @param {Object} req - Node.js IncomingMessage object
   * @param {Object} res - Node.js ServerResponse object
   * @param {Function} next - Passes handling of request to next relevant middleware
   * @returns {undefined} - Sends XML to response, or triggers 404
   */
  async function handleGoogleShoppingFeedRoutes(req, res, next) {
    if (req.originalUrl.startsWith("/google-shopping-feed") === false) {
      next();
      return;
    }

    const primaryShop = await Shops.findOne({ shopType: "primary" });
    if (!primaryShop) {
      res.statusCode = 404;
      res.end();
      return;
    }

    const handle = req.originalUrl.replace("/", "");
    const xml = await getGoogleShoppingFeedXML(context, primaryShop._id, handle);

    // Load and serve feed's XML
    res.setHeader("Content-Type", "text/xml");

    if (xml) {
      res.statusCode = 200;
      res.end(xml);
    } else {
      res.statusCode = 404;
      res.end();
    }
  }

  return handleGoogleShoppingFeedRoutes;
}
