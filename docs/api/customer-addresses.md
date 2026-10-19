# Customer saved addresses

All routes need the customer's JWT (`Authorization: Bearer <accessToken>`).
Every mutation answers `{ addresses: Address[] }` with the full, updated list.

## Address shape

| Field | Type | Notes |
|---|---|---|
| `_id` | string (24-hex) | Stable id. Use it for every update/delete. |
| `type` | string, max 30 | Label: `Home`, `Work` or `Other` (older entries may say `Office`). |
| `address` | string, max 500 | Area / street / locality. |
| `city` | string, max 100 | |
| `pincode` | string, max 10 | The app sends 6 digits. |
| `isDefault` | boolean | Exactly one address is the default once any exist. |
| `latitude`, `longitude` | number | Map pin. Needed to place an order. |
| `houseNo` | string, max 60, optional | House / flat number. |
| `floor` | string, max 30, optional | |
| `landmark` | string, max 120, optional | |
| `receiverName` | string, max 80, optional | Who receives the order. |
| `receiverPhone` | string, optional | 10-digit Indian mobile (`[6-9]` + 9 digits), `+91` prefix accepted and stripped. |

Optional text fields can be cleared by sending an empty string. Unknown fields are rejected (global `forbidNonWhitelisted`); the app's bookkeeping keys `id`, `_id`, `originalIndex` and `listIndex` are accepted and ignored.

## Routes

| Method | Path | Body | Notes |
|---|---|---|---|
| `GET` | `/users/me` | | Profile including `addresses`. |
| `POST` | `/users/addresses` | `type`, `address`, `city`, `pincode` (required) + optional fields | Adding an address with the same `type` + `address` + `city` as an existing one updates that one instead of duplicating it. The first address becomes the default. |
| `PUT` | `/users/addresses/:ref` | any subset of the fields | `isDefault: true` moves the default here. 404 when `:ref` is unknown. |
| `PATCH` | `/users/addresses/:ref/default` | none | Makes this address the only default. 404 when unknown. |
| `DELETE` | `/users/addresses/:ref` | none | Removing the default promotes the first remaining address. 404 for an unknown id. |

`:ref` is the address `_id`. For app builds released before ids existed, a small
integer (`0`–`9999`) is still accepted and treated as the array index (an
out-of-range index on `DELETE` is ignored, as before). Anything else is a 400
`Invalid address id`.

## Ids for existing data

Addresses saved before ids existed are given an `_id` the first time the user is
loaded (`UsersService.findById`), persisted with one conditional update. No
migration script is needed, and addresses are no longer de-duplicated or
reordered on read, so index-based clients keep pointing at the same entry.

## Orders

`POST /orders` `deliveryAddress` is unchanged (`type`, `address`, `city`,
`pincode`, `latitude`, `longitude`). The app folds `houseNo`, `floor` and
`landmark` into `address`, and adds the receiver's name and phone to
`deliveryInstructions`, so riders and the admin panel see them without an order
schema change.
