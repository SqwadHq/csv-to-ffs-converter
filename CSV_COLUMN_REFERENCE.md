# CSV Column Reference Guide

Use this guide to name your columns when uploading a CSV file.

---

## Required Column

| Column Name | Description |
|-------------|-------------|
| `Email` | Email address (required - rows without valid emails are filtered out) |

---

## Personal Information

| Column Name | Alternatives | Description |
|-------------|--------------|-------------|
| `First Name` | `firstName` | User's first name |
| `Last Name` | `lastName` | User's last name |
| `Phone Number` | `phoneHome` | Home phone number |
| `phoneWork` | - | Work phone number |
| `Street` | `street1` | Street address line 1 |
| `street2` | - | Street address line 2 |
| `City` | `city` | City name |
| `State` | `state` | State code (2 characters) |
| `Zip Code` | `zip` | ZIP code (5-digit or ZIP+4) |
| `title` | - | Title/salutation (Mr., Ms., etc.) |
| `middleInitial` | - | Middle initial (1 character) |
| `suffix` | - | Name suffix (Jr., Sr., etc.) |
| `businessName` | - | Business name |
| `country` | - | Country (defaults to "USA") |

---

## Campaign & Tracking

| Column Name | Alternatives | Description |
|-------------|--------------|-------------|
| `UTM Campaign` | `campaignNumber` | Campaign identifier (10 characters) |
| `Sequence Number` | `sequenceNumber`, `SRC Code` | Source code (10 characters). Can use format "campaign-sequence" |
| `SRC Code Vehicle #1` | - | Source code for vehicle 1 (supports "campaign-sequence" format) |
| `SRC Code Vehicle #2` | - | Source code for vehicle 2 |
| `Sign Up Time` | `requestDate` | Timestamp of when user signed up |
| `consumerKey` | - | Consumer key (11 characters) |
| `vin` | - | Vehicle Identification Number (17 characters) |
| `preferredDealer` | - | Preferred dealer code (6 characters) |
| `divisionCode` | - | Division code (defaults to "FD" for Ford, "LM" for Lincoln) |
| `businessFlag` | - | Business flag (defaults to "I") |

---

## Vehicle Selection

| Column Name | Description |
|-------------|-------------|
| `Vehicle #1` | First vehicle name/model |
| `Vehicle #2` | Second vehicle name/model |
| `Vehicle #3` | Third vehicle name/model (and so on...) |
| `Brochure Language` | Language preference: `EN` (English) or `SP` (Spanish) |

### Supported Vehicle Names (per FFS Spec v5.021)

**Ford Vehicles (English):**
- BRONCO
- BRONCO SPORT
- ELECTRIC VEHICLES
- ESCAPE
- EXPEDITION
- EXPLORER
- EXPLORER TREMOR
- F-150
- F-150 LIGHTNING
- F-150 RAPTOR R
- FORD GT
- FORD PERFORMANCE - CARS
- FORD PERFORMANCE - TRUCKS
- MAVERICK
- MUSTANG
- MUSTANG GTD
- MUSTANG MACH-E
- RANGER
- SUPER DUTY (or F-250)
- TRANSIT
- TRANSIT CONNECT WAGON

**Ford Vehicles (Spanish only):**
- EDGE
- ESCAPE
- EXPEDITION
- EXPLORER
- F-150
- MUSTANG
- RANGER
- SUPER DUTY

**Lincoln Vehicles:**
- AVIATOR
- BLACK LABEL
- CORSAIR
- NAUTILUS
- NAVIGATOR

---

## Survey Questions (Exhibition/Events)

| Column Name | Expected Values |
|-------------|-----------------|
| `What age range do you fall into?` | 18-24, 25-29, 30-34, 35-39, 40-44, 45-49, 50-59, 60+ |
| `Select Gender` | Male, Female, Prefer not to say |
| `What is your current vehicle make?` | FORD, LINCOLN, CHEVROLET, TOYOTA, HONDA, NISSAN, HYUNDAI, KIA, JEEP, DODGE, RAM, VOLKSWAGEN, BMW, MERCEDES, AUDI, TESLA, VOLVO, SUBARU, MAZDA, LEXUS, CADILLAC, BUICK, CHRYSLER, PORSCHE, INFINITI, ACURA, JAGUAR, LAND ROVER, RIVIAN, GENESIS, LUCID, POLESTAR, VINFAST, OTHER |
| `When do you plan to acquire your next vehicle?` | 0-30 miles, 1-3 years, 4-6 years, 7+ years, no definite plans |
| `Ford is a brand that helps me do the things I love.` | 1, 2, 3, 4, or 5 |
| `Ford is a brand that helps me feel capable and confident.` | 1, 2, 3, 4, or 5 |
| `What is your annual household income?` | under 50,000, 50,001-74,999, 75,000-99,999, 100,000-150,000, over 150,000, prefer not to say |
| `How much time did you spend in the exhibition?` | less than 15 minutes, 15-30 minutes, 31-60 minutes, more than 60 minutes |
| `How far did you travel to visit the exhibition?` | 10 miles or less, 11-30 miles, 31-50 miles, 51-100 miles, more than 100 miles |
| `How likely is it that you would recommend this exhibition to a friend or colleague?` | 0-10 (NPS scale) |
| `How did you learn about the exhibition?` | newspaper, billboard, email from venue, radio, word of mouth, social media, television, signs within, venue website, online, digital advertising, other |
| `Who are you visiting with today?` | alone, adults only, adults and children, combination, school group, chaperone, other type of group |

---

## Consent/Checkbox Columns

These columns accept: `yes`, `y`, `true`, `checked`, `1`, `yes!`, or `yep`

| Column Name Pattern | Description |
|---------------------|-------------|
| Contains "18" and "older" or "of age" | Age verification (18+) |
| Contains "21" and "older" or "of age" | Age verification (21+) |
| Contains "please email me" or "opt-in" | Email opt-in consent |
| Contains "official rules" and "privacy policy" | Terms acceptance |
| `Are you a current Ford owner?` | Current ownership status |

---

## Custom Questions (Dynamic)

For additional custom questions, use numbered columns:

| Column Name | Description |
|-------------|-------------|
| `question1` through `question30` | Question codes (4-digit numeric) |
| `answer1` through `answer30` | Corresponding answers (up to 20 characters) |

---

## Important Notes

1. **Email is required** - Rows without a valid email will be filtered out
2. **Column names are flexible** - Most matching is case-insensitive
3. **Empty columns are removed** - Columns where all rows are empty are automatically stripped
4. **Vehicle names should match** - Use the exact vehicle names listed above for proper fulfillment code mapping
