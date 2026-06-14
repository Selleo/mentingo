# Billing and Promotion Codes Business Spec

## Business Overview

Billing and promotion codes let Mentingo sell paid courses through Stripe and manage discounts for specific campaigns, customers, or course groups. The feature supports commercial training models where public or partner-facing courses need payment, pricing, and promotion controls.

The implementation is intentionally tied to Stripe configuration. When Stripe is not configured, billing-specific screens redirect or stay hidden so tenants without paid-course needs do not see unusable controls.

## Who Uses It

- Administrators configuring course prices and default currency.
- Learners or customers purchasing paid course access through Stripe checkout.
- Billing managers creating, reviewing, and updating promotion codes.
- Commercial L&D teams assigning discounts to selected paid courses.

## Feature Functions

- Create Stripe payment intents for course payments.
- Create embedded Stripe checkout sessions for paid courses.
- Allow promotion code entry in checkout when configured.
- Process Stripe webhooks for successful payment events.
- List promotion codes with status, usage count, discount type, and value.
- Create promotion codes with fixed or percentage discounts.
- Assign promotion codes to Stripe-connected courses.
- Configure maximum redemptions and expiration dates.
- Edit existing promotion code details.
- Configure course pricing and default course currency when Stripe is available.

## End-User Value

Mentingo can support paid training without building a custom payment processor. Administrators can run limited promotions, course-specific campaigns, and fixed or percentage discounts while Stripe handles payment collection. Learners get a familiar checkout experience embedded into the course flow.

## How It Works

The web app checks whether Stripe is configured before exposing billing workflows. Paid-course purchase flows create an embedded checkout session with course, customer, locale, product, and price information, then invalidate course data when checkout completes. Promotion-code administration uses list, create, and edit screens under the admin billing area.

The API wraps Stripe operations for payment intents, checkout sessions, products, prices, coupons, and promotion codes. Billing checkout endpoints require learner/customer checkout permission, while promotion-code management requires billing management permission. Stripe webhook handling validates raw signed webhook payloads before applying payment-success handling.

## Key Technical Context

- Main API implementation: `apps/api/src/stripe`.
- Main web implementation: `apps/web/app/modules/stripe` and `apps/web/app/modules/Admin/PromotionCodes`.
- Admin routes include `/admin/promotion-codes`, `/admin/promotion-codes/new`, and `/admin/promotion-codes/:id`.
- Access control uses `PERMISSIONS.BILLING_CHECKOUT` for checkout/payment operations and `PERMISSIONS.BILLING_MANAGE` for promotion-code administration.
- Stripe visibility depends on environment configuration exposed through frontend Stripe configuration queries.

## Test Evidence

- Web E2E covers updating course pricing when pricing is enabled.
- Web E2E covers changing the default course currency when Stripe is configured.
- Source-level evidence covers checkout session creation, embedded checkout usage, promotion-code list/create/edit screens, Stripe webhook validation, and billing permission gates.
- I did not find dedicated Stripe or promotion-code API E2E coverage in `apps/api/src/stripe`.
