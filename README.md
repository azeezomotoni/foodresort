# A’s Accessories online store

This is a multi-page storefront: brand home, Our Story, Shop, product details, bag, checkout, order confirmation, and order tracking. Navigation opens separate pages in the same browser tab.

Checkout uses bank transfer. The server calculates the order amount, saves the order, and shows the First City Monument Bank details supplied by the owner. Customers can submit a transfer reference; that changes the status to `transfer_submitted`, which still requires manual confirmation against the account statement. The website never treats a submitted reference as proof of payment.

## Start on Windows

Double-click `start-storefront.cmd`. It opens the local site at `http://localhost:3000` and keeps the Node server running in a console window. Node.js 18 or later is required. If Windows says the command is not recognized, install Node.js from its official website and restart the computer.

Opening `index.html` directly is useful for browsing the catalogue and bag, but order placement and tracking require the server. For those features, use the localhost page opened by `start-storefront.cmd`.

## Bank details

The checkout currently displays:

- Bank / provider: First City Monument Bank
- Account name: As Accessories
- Account number: 2007454151

These values are configurable through `BANK_NAME`, `BANK_ACCOUNT_NAME`, and `BANK_ACCOUNT_NUMBER` in the server environment. `.env.example` shows the settings. Do not include the sample file as if it were a loaded `.env`; set the environment variables in your hosting provider or terminal.

## Orders and launch checklist

- Orders are stored in `data/orders.json` on the server. Back up this file. On a host that resets local files after a redeploy, use managed persistent storage or a database.
- Payment confirmation is manual. After checking the bank statement, update the order's status to `paid` in the orders data. There is no admin dashboard yet.
- Delivery fees are confirmed separately and are not included in the bank transfer subtotal.
- Anti-Bald & Beard Oil has no listed price, so customers must ask about it and cannot add it to an online order until a price is set.
- Stock controls, discount codes, automatic email/WhatsApp confirmations, delivery fee calculation, and an admin dashboard are not included yet.
- Before public launch, deploy to a Node.js host, set `APP_URL` to the public HTTPS domain, confirm bank details, and confirm permission to publish customer photos and feedback.
