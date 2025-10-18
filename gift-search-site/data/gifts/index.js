import { GIFTS_FOR_KIDS_4_13 } from './giftsForKids_4_13.js';
import { GIFTS_FOR_TEENS_13_23 } from './giftsForTeens_13_23.js';
import { GIFTS_FOR_WOMEN } from './giftsForWomen.js';
import { GIFTS_FOR_MEN } from './giftsForMen.js';
import { GIFTS_DIFFERENT } from './giftsDifferent.js';

export const GIFTS = [
  ...GIFTS_FOR_KIDS_4_13,
  ...GIFTS_FOR_TEENS_13_23,
  ...GIFTS_FOR_WOMEN,
  ...GIFTS_FOR_MEN,
  ...GIFTS_DIFFERENT,
];