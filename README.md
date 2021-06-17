# open-commerce-google-shopping-feed

[![npm (scoped)](https://img.shields.io/npm/v/@outgrowio/open-commerce-google-shopping-feed.svg)](https://www.npmjs.com/package/@outgrowio/open-commerce-google-shopping-feed)

This plugin for Mailchimp Open Commerce generates Google Shopping XML feeds.

## How to use

First, install the package in your project's `reaction` (API) directory:

```bash
npm install --save @outgrowio/open-commerce-google-shopping-feed
```

Then, register the plugin in your project's `reaction/plugins.json`:

```json
{
  ...,
  "dummyData": "@outgrowio/open-commerce-google-shopping-feed/index.js"
}
```

With the plugin registered, restart your API container to finalize the installation.

## GraphQL API

Once the plugin is registered, you get access to the following GraphQL mutations and queries. Call these from the GraphQL Playground at http://localhost:3000/graphql.

### Generate the Google Shopping XML feeds

```graphql
mutation generateGoogleShoppingFeeds($input: GenerateGoogleShoppingFeedsInput) {
    generateGoogleShoppingFeeds(input: $input) {
        wasJobScheduled
    }
}
```

Call with the following variables:

```json
{
    "input": {
        "shopId": "cmVhY3Rpb24vc2hvcDpQU3p4M2Myd1luYXZER0FiYw=="
    }
}
```

### Get a feed for a given shop

```graphql
query googleShoppingFeed($handle: String!, $shopUrl: String!) {
    googleShoppingFeed(handle: $handle, shopUrl: $shopUrl) {
        xml
    }
}
```

Call with the following variables:

```json
{
    "handle": "google-shopping-feed.xml",
    "shopUrl": "https://yourshop.com"
}
```

Note: the shop URL needs to be one that's listed in the desired shop's `domains` array (in the `Shops` collection).

### Authentication

Don't forget to use an `Authorization` HTTP header to authenticate your API calls when using the `generateGoogleShoppingFeeds` mutation. Example:

```json
{
    "Authorization": "skwL_8jUOkmom7wW_se6_XgfSBtBrUBSR9UL-CUq74A.fwTZ8_G2QTMPf83O6jAOtYxyEU1TYV6spm8abPENutg"
}
```

You can get the value for the `Authorization` header in the `reaction-admin` UI (http://localhost:4080). By using your browser's network analyzer in the devtools, look for any recent `POST` call to `/graphql` and copy the value for `Authorization` in the request headers.

## Help

Need help integrating this plugin into your Open Commerce project? Simply looking for expert [Open Commerce developers](https://outgrow.io)? Want someone to train your team to use Mailchimp Open Commerce at its fullest?

Whether it is just a one-hour consultation to get you set up or helping your team ship a whole project from start to finish, you can't go wrong by reaching out to us:

* +1 (281) OUT-GROW
* contact@outgrow.io
* https://outgrow.io
