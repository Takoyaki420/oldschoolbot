import { Time, roll } from 'e';

import { MAX_XP } from '../constants.js';
import { assert, Bank, type Item, calcPerHour } from '../util.js';
import { getOSItem } from '../util/getOSItem.js';

export const BEST_SMITHING_XP_HR = 6_700_000;
export const XP_PER_BURNIE_ROLL = 1000;
export const HOURS_FOR_BURNIE = 142;
export const BURNIE_DROPRATE_PER_ROLL = HOURS_FOR_BURNIE * Math.floor(BEST_SMITHING_XP_HR / XP_PER_BURNIE_ROLL);
const MAX_XP_DROPRATE_REDUCTION = 15;

console.log({ BURNIE_DROPRATE_PER_ROLL, XP_PER_BURNIE_ROLL, HOURS_FOR_BURNIE, BEST_SMITHING_XP_HR });
export function rollBurnie({
	totalSmithingXp,
	smithingXpReceived,
	bank,
	messages,
	userCL
}: { smithingXpReceived: number; bank: Bank; totalSmithingXp: number; messages: string[];userCL: Bank; }) {
	const rolls = Math.floor(smithingXpReceived / XP_PER_BURNIE_ROLL);
	if (rolls < 1) return;

	let droprate = BURNIE_DROPRATE_PER_ROLL;
	if (totalSmithingXp === MAX_XP && !userCL.has('Burnie')) {
		droprate  = Math.floor(droprate / MAX_XP_DROPRATE_REDUCTION);
		messages.push(`${MAX_XP_DROPRATE_REDUCTION}x Burnie droprate boost for max Smithing XP`);
	}

	console.log(
		`Getting ${rolls}x 1 in ${BURNIE_DROPRATE_PER_ROLL} rolls for Burnie (roughly 1 in ${1 - Math.pow(1 - 1 / BURNIE_DROPRATE_PER_ROLL, rolls)} chance)`
	);

	for (let i = 0; i < rolls; i++) {
		if (roll(BURNIE_DROPRATE_PER_ROLL)) {
			bank.add('Burnie');
		}
	}
}

const bernieBars: {
	level: number;
	xp: number;
	ore: Item;
	bar: Item;
	coalRequired: number | null;
	timeToUse: number;
}[] = [
	{
		level: 85,
		xp: 50,
		ore: getOSItem('Runite ore'),
		bar: getOSItem('Runite bar'),
		coalRequired: 8,
		timeToUse: Time.Second * 2.4
	},
	{
		level: 70,
		xp: 37.5,
		ore: getOSItem('Adamantite ore'),
		bar: getOSItem('Adamantite bar'),
		coalRequired: 6,
		timeToUse: Time.Second * 2.4
	},
	{
		level: 50,
		xp: 30,
		ore: getOSItem('Mithril ore'),
		bar: getOSItem('Mithril bar'),
		coalRequired: 4,
		timeToUse: Time.Second * 2.4
	},
	{
		level: 40,
		xp: 22.5,
		ore: getOSItem('Gold ore'),
		bar: getOSItem('Gold bar'),
		coalRequired: null,
		timeToUse: Time.Second * 2.4
	},

	{
		level: 20,
		xp: 13.6,
		ore: getOSItem('Silver ore'),
		bar: getOSItem('Silver bar'),
		coalRequired: null,
		timeToUse: Time.Second * 2.4
	},

	{
		level: 15,
		xp: 12.5,
		ore: getOSItem('Iron ore'),
		bar: getOSItem('Iron bar'),
		coalRequired: null,
		timeToUse: Time.Second * 2.4
	}
];

export function burnieBurningOreTripEffect({
	tripLoot,
	userOwnedBank,
	userSmithingLevel,
	tripDuration
}: { userOwnedBank: Bank; tripDuration: number; tripLoot: Bank; userSmithingLevel: number }) {
	const loot = new Bank();
	const cost = new Bank();
	const messages: string[] = [];

	let smithingXpReceived = 0;
	let coalBalance = userOwnedBank.amount('Coal');
	let tripDurationBalance = tripDuration;
	for (const { ore, bar, level, coalRequired, timeToUse, xp } of bernieBars) {
		if (!tripLoot.has(ore)) continue;
		if (userSmithingLevel < level) continue;

		let maxCanDo = Math.min(Math.floor(tripDurationBalance / timeToUse), tripLoot.amount(ore));
		if (maxCanDo <= 0) break;
		let coalUsed = 0;
		if (coalRequired !== null) {
			maxCanDo = Math.min(maxCanDo, Math.floor(coalBalance / coalRequired));
			if (maxCanDo <= 0) continue;
			coalUsed = maxCanDo * coalRequired;
			cost.add('Coal', coalUsed);
			coalBalance -= coalUsed;
		}

		// Definitely using this ore now
		const durationForThisBar = maxCanDo * timeToUse;
		tripDurationBalance -= durationForThisBar;

		assert(
			tripLoot.amount(ore) >= maxCanDo,
			`Trying to use ${maxCanDo} ${ore.name}, but only have ${tripLoot.amount(ore)}`
		);
		cost.add(ore.id, maxCanDo);
		loot.add(bar, maxCanDo);

		const xpForThisBar = maxCanDo * xp;
		smithingXpReceived += xpForThisBar;
		messages.push(
			`Used ${coalUsed} Coal to smelt ${maxCanDo} ${bar.name}, receiving ${smithingXpReceived} Smithing XP (${calcPerHour(xpForThisBar, durationForThisBar).toLocaleString()} xp/hr)`
		);

		assert(tripDurationBalance >= 0);
		assert(coalBalance >= 0);
	}

	assert(tripDurationBalance >= 0);
	assert(coalBalance >= 0);
	assert(userOwnedBank.amount('Coal') >= cost.amount('Coal'));

	if (smithingXpReceived === 0) {
		return null;
	}

	return {
		smithingXpReceived,
		cost,
		loot,
		messages
	};
}
