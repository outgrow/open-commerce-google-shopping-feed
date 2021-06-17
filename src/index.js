import pkg from "../package.json";
import i18n from "./i18n/index.js";
import queries from "./queries/index.js";
import mutations from "./mutations/index.js";
import policies from "./policies.json";
import resolvers from "./resolvers/index.js";
import schemas from "./schemas/index.js";
import startup from "./startup.js";
import updateGoogleShoppingFeedTaskForShop from "./jobs/updateGoogleShoppingFeedTaskForShop.js";

/**
 * @summary Import and call this function to add this plugin to your API.
 * @param {ReactionAPI} app The ReactionAPI instance
 * @returns {undefined}
 */
export default async function register(app) {
  await app.registerPlugin({
    label: "Google Shopping Feed",
    name: "google-shopping-feed",
    version: pkg.version,
    i18n,
    collections: {
      GoogleShoppingFeeds: {
        name: "GoogleShoppingFeeds",
        indexes: [
          [{ shopId: 1, handle: 1 }]
        ]
      }
    },
    functionsByType: {
      startup: [startup]
    },
    backgroundJobs: {
      cleanup: [
        { type: "googleShoppingFeeds/generate", purgeAfterDays: 3 }
      ]
    },
    graphQL: {
      resolvers,
      schemas
    },
    queries,
    mutations,
    policies,
    shopSettingsConfig: {
      googleShoppingFeedRefreshPeriod: {
        afterUpdate(context, { shopId }) {
          updateGoogleShoppingFeedTaskForShop(context, shopId);
        },
        defaultValue: "every 24 hours",
        permissionsThatCanEdit: ["reaction:legacy:googleShoppingFeeds/update:settings"],
        simpleSchema: {
          type: String
        }
      },
      googleShoppingShippingCountry: {
        defaultValue: "US",
        permissionsThatCanEdit: ["reaction:legacy:googleShoppingFeeds/update:settings"],
        simpleSchema: {
          type: String
        }
      }
    }
  });
}
