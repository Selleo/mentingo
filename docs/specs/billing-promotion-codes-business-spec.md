# Billing and Promotion Codes Business Spec

## Business Overview

Billing and promotion codes let Mentingo support paid course access when a tenant uses Stripe. The feature connects course pricing, learner checkout, and discount administration so commercial training programs can sell selected courses without moving payment handling outside the platform.

For HR, L&D, and training providers, the main business purpose is controlled monetization: course managers can mark a course as free or paid, billing managers can prepare discounts for campaigns, and learners can pay from the course flow.

## Who Uses It

- Learners or customers buying access to paid courses.
- Course administrators setting whether a course is free or paid.
- Billing managers creating, reviewing, and updating promotion codes.
- Commercial L&D teams running limited discounts for Stripe-connected courses.

## Feature Functions

- Set a course as free or paid from the course pricing tab when pricing is enabled.
- Store paid-course prices in the selected course currency.
- Start a Stripe checkout flow for a paid course.
- Accept promotion codes during checkout when Stripe configuration allows it.
- List promotion codes with discount, status, redemption, and expiry information.
- Create fixed-amount or percentage promotion codes.
- Limit promotion codes by assigned Stripe-connected courses.
- Configure promotion-code maximum redemptions and expiration dates.
- Review and update existing promotion-code details.

## End-User Value

Learners get a familiar checkout path for paid training. Administrators can keep pricing decisions attached to the course record, while billing managers can run targeted discounts without manual enrollment work or one-off invoicing.

The feature also keeps unpaid tenants out of billing complexity: pricing and checkout surfaces depend on Stripe configuration, so organizations that do not sell paid courses are not asked to maintain payment settings.

## How It Works

Course pricing is managed from the admin course edit workflow. When Stripe is available, the pricing tab lets an administrator switch between free and paid access and save the course price. During purchase, the web app requests a Stripe checkout session or payment setup from the API and renders Stripe payment UI in the learner flow.

Promotion-code management lives in the admin billing area. Billing managers create codes, choose percent or fixed discounts, select eligible Stripe-connected courses, and set redemption or date limits. Codes are then managed through list and detail screens.

The API owns the Stripe boundary. Checkout operations require billing checkout permission, promotion-code operations require billing management permission, and webhook handling validates Stripe-signed requests before applying payment-success behavior.

## Key Technical Context

- Main API implementation: `apps/api/src/stripe`.
- Checkout UI: `apps/web/app/modules/stripe`.
- Promotion-code admin UI: `apps/web/app/modules/Admin/PromotionCodes`.
- Admin routes include `/admin/promotion-codes`, `/admin/promotion-codes/new`, and `/admin/promotion-codes/:id`.
- Course pricing is edited inside the admin course edit workflow.
- Access control uses `PERMISSIONS.BILLING_CHECKOUT` for checkout/payment operations and `PERMISSIONS.BILLING_MANAGE` for promotion-code administration.

## Test Evidence

- Web E2E coverage verifies that an admin can switch a course between paid and free pricing when pricing is enabled.
- Source evidence covers embedded checkout creation, payment intent creation, Stripe webhook validation, promotion-code list/create/update endpoints, and billing permission gates.
- I did not find dedicated backend E2E coverage for the Stripe controller or promotion-code endpoints in the current API test tree.
