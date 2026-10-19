# RS3 Flip Tracker

A tracker for RuneScape 3 Grand Exchange flipping: logging flips, scanning the market for opportunities, and sending Discord alerts.

## Language

**User**:
A person who logs in to the app. Owns flips, goals and scanner presets.
_Avoid_: Account, member

**RS account**:
A RuneScape character (Main, Ironman, Alt, ...) that a User flips on. A User can have several.
_Avoid_: Account (unqualified), character, alt

**Scanner preset**:
A saved set of Scanner filters, owned by a User, that is run on a schedule and posts matching items to Discord.
_Avoid_: Alert rule, saved search

**Scanner alert**:
The Discord post produced when a Scanner preset is due and has something to report.
_Avoid_: Notification

**Out-of-range alert**:
A global Discord post, independent of any Scanner preset or User, for an item whose price in the last 24 hours is far above or below its normal range. Checked on every cron tick.
_Avoid_: Price alert (that name belongs to the User's own target-price rows), spike alert

**Spike**:
An out-of-range alert where the buy-side price (what buyers paid) in the last 24 hours is far above the Normal range high. A price you could sell into.
_Avoid_: Pump

**Dump**:
An out-of-range alert where the sell-side price (what sellers received) in the last 24 hours is far below the Normal range low. A price you could buy at.
_Avoid_: Dip, crash

**Normal range**:
An item's low and high price over the prior 30 days, excluding the last 24 hours. The baseline an out-of-range price is measured against.
_Avoid_: Fair value, average
