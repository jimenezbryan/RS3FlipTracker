/**
 * ArchaeologyTracker.jsx
 *
 * RS3 Archaeology progress tracker — dual-account guided checklist.
 * Stack: React + Tailwind CSS + shadcn/ui + localStorage persistence.
 *
 * Usage:
 *   import ArchaeologyTracker from '@/components/ArchaeologyTracker'
 *   <ArchaeologyTracker />
 *
 * Fonts (add to your index.html or _document.jsx):
 *   <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,300&display=swap" rel="stylesheet" />
 *
 * shadcn/ui components used: Tabs, Progress, Badge, Collapsible
 * Install if not already present:
 *   npx shadcn@latest add tabs progress badge collapsible
 */

import { useState, useEffect, useCallback } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronDown, ChevronUp, CheckCircle2, Circle } from 'lucide-react'

// ─────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────

const ACCOUNTS = [
  {
    id: 'acc0',
    name: 'Account 1',
    subtitle: 'Lvl 62 Arch · 57 Invention',
    sections: [
      {
        id: 'a0-immediate',
        icon: '⚡',
        title: 'IMMEDIATE PRIORITIES',
        meta: 'Do these first',
        items: [
          { id: 'a0-i1', text: 'Complete Dagon Bye mystery at Infernal Source', note: 'Unlocks Ancient Summoning + waterfiend familiar', tags: ['priority'] },
          { id: 'a0-i2', text: 'Buy Dragon mattock from Grand Exchange', note: 'Best augmentable mattock available at 60+ Arch', tags: ['priority'] },
          { id: 'a0-i3', text: 'Augment Dragon mattock at Invention workbench', note: 'Requires level 22 Invention ✅ you have 57', tags: ['priority'] },
          { id: 'a0-i4', text: 'Add Honed 4 perk to mattock gizmo slot 1', note: '12% higher chance of gathering materials', tags: ['priority'] },
          { id: 'a0-i5', text: 'Add Fortune 3 + Prosper to mattock gizmo slot 2', note: 'Banks materials to storage — bring prayer restore items', tags: ['priority'] },
          { id: 'a0-i6', text: 'Bind a waterfiend familiar', note: 'Need: binding contract + 50 Summ ✅ + 50 Slay ✅ + Dagon Bye done', tags: ['priority'] },
          { id: 'a0-i7', text: 'Stack all 4 consumables before each session', note: 'Arch tea + hi-spec monocle + material manual + tarpaulin sheet', tags: [] },
          { id: 'a0-i8', text: 'Send researchers on missions on every login', note: 'Never leave researchers idle — passive XP and materials', tags: [] },
        ],
      },
      {
        id: 'a0-setup',
        icon: '⚙️',
        title: 'FULL SETUP CHECKLIST',
        meta: 'Gear & consumables',
        items: [
          { id: 'a0-s1', text: 'Augmented Dragon mattock equipped', note: 'With Honed 4 + Fortune 3 / Prosper perks', tags: [] },
          { id: 'a0-s2', text: 'Waterfiend familiar summoned', note: '5% chance to duplicate excavated resources', tags: [] },
          { id: 'a0-s3', text: 'Archaeologist\'s tea active', note: 'Boosts excavation success rate', tags: [] },
          { id: 'a0-s4', text: 'Hi-spec monocle active', note: 'Increases artefact progress speed', tags: [] },
          { id: 'a0-s5', text: 'Material manual active', note: 'Boosts material gathering rate', tags: [] },
          { id: 'a0-s6', text: 'Tarpaulin sheet active', note: 'Reduces material cost for restoring artefacts', tags: [] },
          { id: 'a0-s7', text: 'Archaeological soil box in inventory', note: 'Holds soil so you can stay at dig site longer', tags: [] },
          { id: 'a0-s8', text: 'Standard Archaeologist\'s outfit purchased (at lvl 70)', note: '50,000 chronotes from Ezreal — 6% XP boost', tags: ['milestone'] },
          { id: 'a0-s9', text: 'Auto-screener v1.080 built (lvl 70 + 67 Inv)', note: 'Auto-screens soil while excavating — huge QoL', tags: ['milestone'] },
        ],
      },
      {
        id: 'a0-infernal',
        icon: '🔥',
        title: 'LEVELS 62–70 — INFERNAL SOURCE',
        meta: 'Current location',
        items: [
          { id: 'a0-if1', text: 'Excavate Lodge art storage hotspots (62–63)', note: 'Follow time sprite for faster artefact progress', tags: [] },
          { id: 'a0-if2', text: 'Excavate Avernic weaponry cache (63–67)', note: 'Best XP at this range in Infernal Source', tags: [] },
          { id: 'a0-if3', text: 'Excavate Avernic remains (67–70)', note: 'Keep restoring all artefacts found', tags: [] },
          { id: 'a0-if4', text: 'Complete all Infernal Source mysteries', note: 'Each gives one-off XP reward + unlocks content', tags: [] },
          { id: 'a0-if5', text: 'Hand in artefact collections to collectors for chronotes', note: 'Priority: first completion of each collection', tags: [] },
          { id: 'a0-if6', text: 'Reach 250 total artefacts restored', note: 'Required for Associate Qualification at level 70', tags: ['milestone'] },
          { id: 'a0-if7', text: 'Complete 5 artefact collections total', note: 'Also required for Associate Qualification', tags: ['milestone'] },
          { id: 'a0-if8', text: 'UNLOCK Associate Qualification at level 70', note: 'Visit Ezreal at Archaeology Guild — unlocks outfit + auto-screener', tags: ['milestone'] },
          { id: 'a0-if9', text: 'Buy mattock precision upgrades from guild shop', note: 'Do this BEFORE buying outfit — bigger XP impact', tags: [] },
        ],
      },
      {
        id: 'a0-everlight',
        icon: '✨',
        title: 'LEVELS 70–83 — EVERLIGHT DIG SITE',
        meta: 'Unlock at level 70',
        items: [
          { id: 'a0-el1', text: 'Talk to Everlight dig site manager on arrival', note: 'Always speak to manager when unlocking a new site', tags: [] },
          { id: 'a0-el2', text: 'Excavate Icyene burial remains (70–72)', note: '', tags: [] },
          { id: 'a0-el3', text: 'Excavate Icyene weapon rack (72–74)', note: '', tags: [] },
          { id: 'a0-el4', text: 'Excavate Icyene equipment storage (74–76)', note: '', tags: [] },
          { id: 'a0-el5', text: 'Excavate Dominion Games podium (76–78)', note: '', tags: [] },
          { id: 'a0-el6', text: 'Excavate Dominion Games amphitheatre (78–81)', note: '', tags: [] },
          { id: 'a0-el7', text: 'Excavate Oikos fishing hut debris (81–83)', note: '', tags: [] },
          { id: 'a0-el8', text: 'Complete all Everlight mysteries', note: 'Large one-off XP rewards — do not skip', tags: [] },
          { id: 'a0-el9', text: 'Buy all remaining mattock precision upgrades', note: 'Use chronotes earned from collections', tags: [] },
        ],
      },
      {
        id: 'a0-storm',
        icon: '⚔️',
        title: 'LEVELS 83–90 — STORMGUARD & WARFORGE',
        meta: 'Stormguard unlocks at 70, Warforge at 76',
        items: [
          { id: 'a0-st1', text: 'Excavate Keshik tower debris at Stormguard (83–85)', note: '', tags: [] },
          { id: 'a0-st2', text: 'Excavate Golem parts at Warforge (85–87)', note: '', tags: [] },
          { id: 'a0-st3', text: 'Excavate Yu\'biusk animal pens at Warforge (87–90)', note: '~125k XP/hr with full setup', tags: [] },
          { id: 'a0-st4', text: 'Restore a Stormguard gerege and add to toolbelt', note: 'Required to unlock Ancient Invention', tags: ['milestone'] },
          { id: 'a0-st5', text: 'Complete Howl\'s Floating Workshop mystery', note: 'UNLOCKS ANCIENT INVENTION — major perk upgrade!', tags: ['milestone'] },
          { id: 'a0-st6', text: 'Unlock Ancient Invention blueprints', note: 'Allows much stronger perks on your mattock', tags: ['milestone'] },
          { id: 'a0-st7', text: 'Upgrade mattock to ancient perks', note: 'Gizmo 1: Honed 6 + Imp Souled 3 | Gizmo 2: Fortune 4 + Prosper', tags: ['milestone'] },
          { id: 'a0-st8', text: 'UNLOCK Professor Qualification at level 90', note: 'More research slots + further mattock precision upgrades', tags: ['milestone'] },
          { id: 'a0-st9', text: 'Upgrade to Imcando mattock at level 80', note: 'Dragon mattock + 4 imcando metals + 1M gp from Thurgo', tags: ['milestone'] },
        ],
      },
      {
        id: 'a0-orthen',
        icon: '🦖',
        title: 'LEVELS 90–99 — ORTHEN DIG SITE',
        meta: 'Unlock at level 90 — Anachronia',
        items: [
          { id: 'a0-or1', text: 'Unlock Orthen dig site (requires Associate Qualification)', note: 'Located on Anachronia island', tags: [] },
          { id: 'a0-or2', text: 'Talk to Orthen dig site manager on arrival', note: '', tags: [] },
          { id: 'a0-or3', text: 'Excavate Moksha ritual site hotspots (90–95)', note: 'Follow time sprite consistently', tags: [] },
          { id: 'a0-or4', text: 'Excavate Crypt of Varanus — Dragonkin coffin (95–99)', note: '~130k XP/hr with full setup', tags: [] },
          { id: 'a0-or5', text: 'Complete all Orthen mysteries', note: 'Big one-off XP rewards', tags: [] },
          { id: 'a0-or6', text: 'Farm Dragonkin 2 collection for rex skeleton fragments', note: 'Good passive money alongside XP at 95+', tags: [] },
          { id: 'a0-or7', text: 'Reach 1000 total artefacts restored', note: 'Required for Guildmaster Qualification', tags: ['milestone'] },
          { id: 'a0-or8', text: 'Complete 25 artefact collections total', note: 'Required for Guildmaster Qualification', tags: ['milestone'] },
          { id: 'a0-or9', text: 'Complete 20 mysteries total', note: 'Required for Guildmaster Qualification', tags: ['milestone'] },
          { id: 'a0-or10', text: 'UNLOCK Guildmaster Qualification at level 99', note: 'Unlocks Master outfit + Time and Space mattock components', tags: ['milestone'] },
          { id: 'a0-or11', text: 'Buy Master Archaeologist\'s outfit (250,000 chronotes)', note: '7% XP boost + unlimited teleports + faster restoring', tags: ['milestone'] },
          { id: 'a0-or12', text: 'Buy energised meteorite shard (250,000 chronotes)', note: 'Required for Mattock of Time and Space', tags: ['milestone'] },
          { id: 'a0-or13', text: 'Craft Mattock of Time and Space at Mysterious Monolith', note: 'Needs: Crystal/Imcando mattock + energised shard + Plague\'s End', tags: ['milestone'] },
        ],
      },
      {
        id: 'a0-endgame',
        icon: '👑',
        title: 'LEVELS 99–120 — ENDGAME GRIND',
        meta: 'Final stretch',
        items: [
          { id: 'a0-eg1', text: 'Excavate Kharid-et Culinarum debris (99–107)', note: 'Best money + XP — farm Zarosian 4 collection for Inquisitor staff pieces', tags: [] },
          { id: 'a0-eg2', text: 'Activate all shadow anchors at Kharid-et with pylon batteries', note: '10 batteries per anchor — grants bonus XP events', tags: [] },
          { id: 'a0-eg3', text: 'Excavate Orthen Observation Outpost — Autopsy Table (107–113)', note: 'Autopsy table + Experiment workbench hotspots', tags: [] },
          { id: 'a0-eg4', text: 'Complete first commander mystery at Warforge (partial)', note: 'Required prerequisite for final area unlock', tags: [] },
          { id: 'a0-eg5', text: 'Complete "Power Behind the Throne" research mission', note: 'Required to unlock final Warforge area', tags: [] },
          { id: 'a0-eg6', text: 'Complete "Too Many Bones" research mission', note: 'Required to unlock final Warforge area', tags: [] },
          { id: 'a0-eg7', text: 'Restore Forged in War artefact', note: 'Required for final commander mystery', tags: [] },
          { id: 'a0-eg8', text: 'Restore Dorgeshuun spear artefact', note: 'Required for final commander mystery', tags: [] },
          { id: 'a0-eg9', text: 'Complete final commander mystery at Warforge', note: 'Unlocks the final excavation area', tags: ['milestone'] },
          { id: 'a0-eg10', text: 'Excavate final Warforge area (113–120)', note: 'Final stretch!', tags: [] },
          { id: 'a0-eg11', text: 'REACH LEVEL 120 ARCHAEOLOGY 🎉', note: 'Collect Archaeology master cape from Acting Guildmaster Reiniger', tags: ['milestone'] },
        ],
      },
    ],
  },
  {
    id: 'acc1',
    name: 'Account 2',
    subtitle: 'Lvl 51 Arch · 37 Invention',
    sections: [
      {
        id: 'a1-immediate',
        icon: '⚡',
        title: 'IMMEDIATE PRIORITIES',
        meta: 'Do these first',
        items: [
          { id: 'a1-i1', text: 'Use best available mattock (Orikalkum — level 50)', note: 'Best unaugmentable mattock at your current level', tags: ['priority'] },
          { id: 'a1-i2', text: 'Stack all 4 consumables before each session', note: 'Arch tea + hi-spec monocle + material manual + tarpaulin sheet', tags: ['priority'] },
          { id: 'a1-i3', text: 'Send researchers on missions on every login', note: 'Never leave researchers idle — passive XP + materials', tags: ['priority'] },
          { id: 'a1-i4', text: 'Restore every artefact you find', note: 'Need 250 total restorations for Associate Qualification', tags: ['priority'] },
          { id: 'a1-i5', text: 'Complete Dagon Bye mystery at Infernal Source', note: 'Unlocks Ancient Summoning — needed for waterfiend later', tags: ['priority'] },
          { id: 'a1-i6', text: 'Train Summoning in the background toward level 50', note: 'Collect charms from combat — need 50 Summ + 50 Slay for waterfiend', tags: [] },
        ],
      },
      {
        id: 'a1-setup',
        icon: '⚙️',
        title: 'PROGRESSIVE SETUP CHECKLIST',
        meta: 'Unlock as you level up',
        items: [
          { id: 'a1-s1', text: 'Use Orikalkum mattock now (level 50 Arch ✅)', note: 'Best option until level 60', tags: [] },
          { id: 'a1-s2', text: 'Reach level 60 → buy Dragon mattock from GE', note: 'Significant precision boost — buy immediately at 60', tags: ['milestone'] },
          { id: 'a1-s3', text: 'Augment Dragon mattock at Invention workbench', note: 'Requires level 22 Invention ✅ you have 37', tags: ['milestone'] },
          { id: 'a1-s4', text: 'Add Honed 2–3 perk (current 37 Invention)', note: 'Best Honed rank reliably achievable at 37 Invention', tags: [] },
          { id: 'a1-s5', text: 'Add Prosper perk to second gizmo slot', note: 'Cheap and easy — good placeholder', tags: [] },
          { id: 'a1-s6', text: 'Upgrade mattock perks as Invention levels up', note: 'Target: Honed 4 + Fortune 3 when Invention is higher', tags: [] },
          { id: 'a1-s7', text: 'Reach 50 Summ + 50 Slay + Dagon Bye → get waterfiend', note: '5% resource duplication — worth getting ASAP', tags: ['milestone'] },
          { id: 'a1-s8', text: 'Standard Archaeologist\'s outfit at level 70 (50,000 chronotes)', note: '6% XP boost — buy from Ezreal after Associate Qualification', tags: ['milestone'] },
          { id: 'a1-s9', text: 'Auto-screener v1.080 at level 70 (needs 67 Invention)', note: 'Need to level Invention to 67 first', tags: ['milestone'] },
          { id: 'a1-s10', text: 'Upgrade to Imcando mattock at level 80', note: 'Dragon mattock + 4 imcando metals + 1M gp from Thurgo', tags: ['milestone'] },
        ],
      },
      {
        id: 'a1-infernal',
        icon: '🔥',
        title: 'LEVELS 51–70 — INFERNAL SOURCE',
        meta: 'Current location',
        items: [
          { id: 'a1-if1', text: 'Excavate Dis dungeon debris (51–56)', note: 'Follow time sprite for faster artefact progress', tags: [] },
          { id: 'a1-if2', text: 'Excavate Avernic capsule debris (56–58)', note: '', tags: [] },
          { id: 'a1-if3', text: 'Excavate Avernic weaponry cache (58–62)', note: '', tags: [] },
          { id: 'a1-if4', text: 'Excavate Avernic remains (62–67)', note: '', tags: [] },
          { id: 'a1-if5', text: 'Excavate Infernal throne room (67–70)', note: '', tags: [] },
          { id: 'a1-if6', text: 'Complete all Infernal Source mysteries', note: 'Includes Dagon Bye — unlocks Ancient Summoning', tags: [] },
          { id: 'a1-if7', text: 'Hand in artefact collections to collectors for chronotes', note: 'Prioritise first completion of each collection', tags: [] },
          { id: 'a1-if8', text: 'Reach 250 total artefacts restored', note: 'Required for Associate Qualification', tags: ['milestone'] },
          { id: 'a1-if9', text: 'Complete 5 artefact collections total', note: 'Required for Associate Qualification', tags: ['milestone'] },
          { id: 'a1-if10', text: 'UNLOCK Associate Qualification at level 70', note: 'Visit Ezreal at Archaeology Guild', tags: ['milestone'] },
          { id: 'a1-if11', text: 'Buy mattock precision upgrades from guild shop first', note: 'More impactful than outfit — spend chronotes here first', tags: [] },
        ],
      },
      {
        id: 'a1-everlight',
        icon: '✨',
        title: 'LEVELS 70–83 — EVERLIGHT DIG SITE',
        meta: 'Unlock at level 70',
        items: [
          { id: 'a1-el1', text: 'Talk to Everlight dig site manager on arrival', note: '', tags: [] },
          { id: 'a1-el2', text: 'Excavate Icyene burial remains (70–72)', note: '', tags: [] },
          { id: 'a1-el3', text: 'Excavate Icyene weapon rack (72–74)', note: '', tags: [] },
          { id: 'a1-el4', text: 'Excavate Icyene equipment storage (74–76)', note: '', tags: [] },
          { id: 'a1-el5', text: 'Excavate Dominion Games podium (76–78)', note: '', tags: [] },
          { id: 'a1-el6', text: 'Excavate Dominion Games amphitheatre (78–81)', note: '', tags: [] },
          { id: 'a1-el7', text: 'Excavate Oikos fishing hut debris (81–83)', note: '', tags: [] },
          { id: 'a1-el8', text: 'Complete all Everlight mysteries', note: 'Large one-off XP rewards — do not skip', tags: [] },
          { id: 'a1-el9', text: 'Buy all remaining mattock precision upgrades', note: 'Use chronotes from collections', tags: [] },
        ],
      },
      {
        id: 'a1-storm',
        icon: '⚔️',
        title: 'LEVELS 83–90 — STORMGUARD & WARFORGE',
        meta: 'Stormguard unlocks at 70, Warforge at 76',
        items: [
          { id: 'a1-st1', text: 'Excavate Keshik tower debris at Stormguard (83–85)', note: '', tags: [] },
          { id: 'a1-st2', text: 'Excavate Golem parts at Warforge (85–87)', note: '', tags: [] },
          { id: 'a1-st3', text: 'Excavate Yu\'biusk animal pens at Warforge (87–90)', note: '~125k XP/hr with full setup', tags: [] },
          { id: 'a1-st4', text: 'Restore a Stormguard gerege and add to toolbelt', note: 'Required prerequisite for Ancient Invention', tags: ['milestone'] },
          { id: 'a1-st5', text: 'Complete Howl\'s Floating Workshop mystery', note: 'UNLOCKS ANCIENT INVENTION — major upgrade!', tags: ['milestone'] },
          { id: 'a1-st6', text: 'Unlock Ancient Invention blueprints', note: 'Allows ancient gizmos with much stronger perks', tags: ['milestone'] },
          { id: 'a1-st7', text: 'Upgrade mattock to ancient perks', note: 'Gizmo 1: Honed 6 + Imp Souled 3 | Gizmo 2: Fortune 4 + Prosper', tags: ['milestone'] },
          { id: 'a1-st8', text: 'UNLOCK Professor Qualification at level 90', note: 'Bigger research team + more mattock precision upgrades', tags: ['milestone'] },
        ],
      },
      {
        id: 'a1-orthen',
        icon: '🦖',
        title: 'LEVELS 90–99 — ORTHEN DIG SITE',
        meta: 'Unlock at level 90 — Anachronia',
        items: [
          { id: 'a1-or1', text: 'Unlock Orthen dig site (requires Associate Qualification)', note: 'Located on Anachronia island', tags: [] },
          { id: 'a1-or2', text: 'Talk to Orthen dig site manager on arrival', note: '', tags: [] },
          { id: 'a1-or3', text: 'Excavate Moksha ritual site hotspots (90–95)', note: 'Follow time sprite consistently', tags: [] },
          { id: 'a1-or4', text: 'Excavate Crypt of Varanus — Dragonkin coffin (95–99)', note: '~130k XP/hr with full setup', tags: [] },
          { id: 'a1-or5', text: 'Complete all Orthen mysteries', note: 'Big one-off XP rewards', tags: [] },
          { id: 'a1-or6', text: 'Farm Dragonkin 2 collection for rex skeleton fragments', note: 'Good money making alongside XP at 95+', tags: [] },
          { id: 'a1-or7', text: 'Reach 1000 total artefacts restored', note: 'Required for Guildmaster Qualification', tags: ['milestone'] },
          { id: 'a1-or8', text: 'Complete 25 artefact collections total', note: 'Required for Guildmaster Qualification', tags: ['milestone'] },
          { id: 'a1-or9', text: 'Complete 20 mysteries total', note: 'Required for Guildmaster Qualification', tags: ['milestone'] },
          { id: 'a1-or10', text: 'UNLOCK Guildmaster Qualification at level 99', note: 'Unlocks Master outfit + Time and Space mattock components', tags: ['milestone'] },
          { id: 'a1-or11', text: 'Buy Master Archaeologist\'s outfit (250,000 chronotes)', note: '7% XP boost + unlimited teleports + faster restoring', tags: ['milestone'] },
          { id: 'a1-or12', text: 'Buy energised meteorite shard (250,000 chronotes)', note: 'Required for Mattock of Time and Space', tags: ['milestone'] },
          { id: 'a1-or13', text: 'Craft Mattock of Time and Space at Mysterious Monolith', note: 'Needs: Crystal/Imcando mattock + energised shard + Plague\'s End', tags: ['milestone'] },
        ],
      },
      {
        id: 'a1-endgame',
        icon: '👑',
        title: 'LEVELS 99–120 — ENDGAME GRIND',
        meta: 'Final stretch',
        items: [
          { id: 'a1-eg1', text: 'Excavate Kharid-et Culinarum debris (99–107)', note: 'Best money + XP — farm Zarosian 4 collection for Inquisitor staff pieces', tags: [] },
          { id: 'a1-eg2', text: 'Activate shadow anchors at Kharid-et with pylon batteries', note: '10 batteries per anchor — grants bonus XP events', tags: [] },
          { id: 'a1-eg3', text: 'Excavate Orthen Observation Outpost — Autopsy Table (107–113)', note: 'Autopsy table + Experiment workbench hotspots', tags: [] },
          { id: 'a1-eg4', text: 'Complete first commander mystery at Warforge (partial)', note: 'Required prerequisite for final area unlock', tags: [] },
          { id: 'a1-eg5', text: 'Complete "Power Behind the Throne" research mission', note: 'Required to unlock final Warforge area', tags: [] },
          { id: 'a1-eg6', text: 'Complete "Too Many Bones" research mission', note: 'Required to unlock final Warforge area', tags: [] },
          { id: 'a1-eg7', text: 'Restore Forged in War artefact', note: 'Required for final commander mystery', tags: [] },
          { id: 'a1-eg8', text: 'Restore Dorgeshuun spear artefact', note: 'Required for final commander mystery', tags: [] },
          { id: 'a1-eg9', text: 'Complete final commander mystery at Warforge', note: 'Unlocks the final excavation area', tags: ['milestone'] },
          { id: 'a1-eg10', text: 'Excavate final Warforge area (113–120)', note: 'Final stretch!', tags: [] },
          { id: 'a1-eg11', text: 'REACH LEVEL 120 ARCHAEOLOGY 🎉', note: 'Collect Archaeology master cape from Acting Guildmaster Reiniger', tags: ['milestone'] },
        ],
      },
    ],
  },
]

const STORAGE_KEY = 'rs3_arch_tracker_v2'

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function loadStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : { checked: {}, collapsed: {} }
  } catch {
    return { checked: {}, collapsed: {} }
  }
}

function saveStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

function getAccountProgress(account, checked) {
  let total = 0, done = 0
  account.sections.forEach(s =>
    s.items.forEach(item => { total++; if (checked[item.id]) done++ })
  )
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
}

function getSectionProgress(section, checked) {
  const total = section.items.length
  const done = section.items.filter(i => checked[i.id]).length
  return { done, total, allDone: done === total }
}

// ─────────────────────────────────────────────
// TAG COMPONENT
// ─────────────────────────────────────────────

const TAG_STYLES = {
  priority: 'border border-[#8a3a2a] bg-[#8a3a2a]/20 text-[#ff7a5a]',
  milestone: 'border border-[var(--arch-gold-dim)] bg-[var(--arch-gold)]/10 text-[var(--arch-gold-light)]',
}

function ItemTag({ type }) {
  const label = type === 'priority' ? 'PRIORITY' : 'MILESTONE'
  return (
    <span
      className={`inline-block px-1.5 py-0 rounded-sm text-[9px] tracking-widest ml-1.5 align-middle font-cinzel ${TAG_STYLES[type] ?? ''}`}
    >
      {label}
    </span>
  )
}

// ─────────────────────────────────────────────
// CHECK ITEM COMPONENT
// ─────────────────────────────────────────────

function CheckItem({ item, checked, onToggle }) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => onToggle(item.id)}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onToggle(item.id)}
      className={`
        flex items-start gap-3 px-4 py-2.5 border-b border-[var(--arch-bg3)] last:border-b-0
        cursor-pointer select-none transition-colors duration-150
        hover:bg-[var(--arch-gold)]/[0.03]
        ${checked ? 'opacity-50' : ''}
      `}
    >
      {/* Checkbox */}
      <div className="mt-0.5 shrink-0">
        {checked
          ? <CheckCircle2 size={16} className="text-[var(--arch-green-bright)]" />
          : <Circle size={16} className="text-[var(--arch-border-bright)]" />
        }
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug text-[var(--arch-text-bright)] font-crimson ${checked ? 'line-through decoration-[var(--arch-gold-dim)]' : ''}`}>
          {item.text}
          {item.tags.map(t => <ItemTag key={t} type={t} />)}
        </p>
        {item.note && (
          <p className="text-xs text-[var(--arch-text-dim)] italic mt-0.5 font-crimson font-light">
            {item.note}
          </p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// SECTION COMPONENT
// ─────────────────────────────────────────────

function TrackerSection({ section, checked, onToggle, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  const { done, total, allDone } = getSectionProgress(section, checked)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={`
        rounded-sm border transition-colors duration-200 overflow-hidden
        ${allDone
          ? 'border-[var(--arch-green)] bg-[var(--arch-green)]/5'
          : 'border-[var(--arch-border)] hover:border-[var(--arch-border-bright)]'
        }
      `}>
        <CollapsibleTrigger asChild>
          <div className={`
            flex items-center gap-3 px-4 py-3 cursor-pointer select-none
            transition-colors duration-150
            ${allDone ? 'bg-[var(--arch-green)]/8' : 'bg-[var(--arch-panel2)] hover:bg-[#2a2010]'}
          `}>
            <span className="text-base shrink-0">{allDone ? '✅' : section.icon}</span>

            <span className={`
              font-cinzel text-[10px] tracking-[0.15em] flex-1
              ${allDone ? 'text-[var(--arch-green-bright)]' : 'text-[var(--arch-gold)]'}
            `}>
              {section.title}
            </span>

            <span className="text-[11px] text-[var(--arch-text-dim)] italic font-crimson font-light hidden sm:block">
              {section.meta}
            </span>

            <span className={`
              font-cinzel text-[10px] ml-2 shrink-0
              ${allDone ? 'text-[var(--arch-green-bright)]' : 'text-[var(--arch-text-dim)]'}
            `}>
              {done}/{total}
            </span>

            {open
              ? <ChevronUp size={13} className="text-[var(--arch-text-dim)] shrink-0" />
              : <ChevronDown size={13} className="text-[var(--arch-text-dim)] shrink-0" />
            }
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-[var(--arch-bg3)]">
            {section.items.map(item => (
              <CheckItem
                key={item.id}
                item={item}
                checked={!!checked[item.id]}
                onToggle={onToggle}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

// ─────────────────────────────────────────────
// ACCOUNT PANEL COMPONENT
// ─────────────────────────────────────────────

function AccountPanel({ account, checked, onToggle, onReset }) {
  const { done, total, pct } = getAccountProgress(account, checked)

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="flex items-center gap-3 bg-[var(--arch-panel)] border border-[var(--arch-border)] rounded-sm px-4 py-3">
        <span className="font-cinzel text-[9px] tracking-[0.18em] text-[var(--arch-text-dim)] shrink-0">
          OVERALL
        </span>
        <Progress
          value={pct}
          className="flex-1 h-1.5 bg-[var(--arch-bg3)] [&>div]:bg-gradient-to-r [&>div]:from-[var(--arch-gold-dim)] [&>div]:to-[var(--arch-gold-light)]"
        />
        <span className="font-cinzel text-xs text-[var(--arch-gold-light)] shrink-0">
          {done}/{total} <span className="text-[var(--arch-text-dim)]">({pct}%)</span>
        </span>
      </div>

      {/* Sections */}
      {account.sections.map((section, idx) => (
        <TrackerSection
          key={section.id}
          section={section}
          checked={checked}
          onToggle={onToggle}
          defaultOpen={idx === 0}
        />
      ))}

      {/* Reset */}
      <div className="pt-2 pb-1 text-center">
        <button
          onClick={onReset}
          className="font-cinzel text-[9px] tracking-[0.18em] text-[#ff7a5a] border border-[#8a3a2a] px-4 py-1.5 rounded-sm hover:bg-[#8a3a2a]/20 transition-colors duration-150"
        >
          RESET {account.name.toUpperCase()}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// ROOT COMPONENT
// ─────────────────────────────────────────────

export default function ArchaeologyTracker() {
  const [checked, setChecked] = useState({})

  // Load from localStorage on mount
  useEffect(() => {
    const { checked: savedChecked } = loadStorage()
    setChecked(savedChecked)
  }, [])

  // Persist on change
  useEffect(() => {
    saveStorage({ checked })
  }, [checked])

  const toggleItem = useCallback((itemId) => {
    setChecked(prev => ({ ...prev, [itemId]: !prev[itemId] }))
  }, [])

  const resetAccount = useCallback((account) => {
    if (!window.confirm(`Reset all progress for ${account.name}?`)) return
    setChecked(prev => {
      const next = { ...prev }
      account.sections.forEach(s => s.items.forEach(i => { delete next[i.id] }))
      return next
    })
  }, [])

  return (
    <>
      {/* CSS custom properties — scoped to this component */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,300&display=swap');

        .font-cinzel { font-family: 'Cinzel', serif; }
        .font-crimson { font-family: 'Crimson Pro', Georgia, serif; }

        .arch-tracker {
          --arch-gold:            #d4a843;
          --arch-gold-light:      #f0c96a;
          --arch-gold-dim:        #8a6a20;
          --arch-bg:              #0e0b07;
          --arch-bg3:             #1e1810;
          --arch-panel:           #1a1408;
          --arch-panel2:          #231b0e;
          --arch-border:          #3a2d14;
          --arch-border-bright:   #6a4f1e;
          --arch-text:            #c8b888;
          --arch-text-dim:        #7a6840;
          --arch-text-bright:     #e8d8a8;
          --arch-green:           #4a8a3a;
          --arch-green-bright:    #6ab85a;
        }
      `}</style>

      <div
        className="arch-tracker min-h-screen bg-[var(--arch-bg)] text-[var(--arch-text)] font-crimson"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 10% 10%, rgba(212,168,67,0.04) 0%, transparent 50%),
            radial-gradient(ellipse at 90% 90%, rgba(42,98,208,0.03) 0%, transparent 50%)
          `,
        }}
      >
        <div className="max-w-3xl mx-auto px-4 py-8">

          {/* Header */}
          <header className="text-center pb-7 mb-7 border-b border-[var(--arch-border)]">
            <p className="font-cinzel text-[9px] tracking-[0.3em] text-[var(--arch-gold-dim)] mb-3">
              ⸻ ✦ ⸻
            </p>
            <h1 className="font-cinzel font-bold text-2xl sm:text-3xl tracking-[0.2em] text-[var(--arch-gold-light)]"
              style={{ textShadow: '0 0 30px rgba(212,168,67,0.3)' }}>
              ARCHAEOLOGY TRACKER
            </h1>
            <p className="text-[var(--arch-text-dim)] text-sm italic mt-2 tracking-wide font-light">
              RuneScape 3 — Guided Progress Checklist
            </p>
            <p className="font-cinzel text-[9px] tracking-[0.3em] text-[var(--arch-gold-dim)] mt-3">
              ⸻ ✦ ⸻
            </p>
          </header>

          {/* Tabs */}
          <Tabs defaultValue="acc0">
            <TabsList className="w-full bg-[var(--arch-panel)] border border-[var(--arch-border)] rounded-sm p-1 mb-6 h-auto gap-1">
              {ACCOUNTS.map(acc => {
                const { pct } = getAccountProgress(acc, checked)
                return (
                  <TabsTrigger
                    key={acc.id}
                    value={acc.id}
                    className={`
                      flex-1 flex flex-col py-2.5 px-3 rounded-sm h-auto
                      data-[state=active]:bg-[var(--arch-panel2)]
                      data-[state=active]:text-[var(--arch-gold-light)]
                      data-[state=active]:border-b-2 data-[state=active]:border-[var(--arch-gold)]
                      data-[state=inactive]:text-[var(--arch-text-dim)]
                      transition-colors duration-150
                    `}
                  >
                    <span className="font-cinzel text-[10px] tracking-[0.18em]">{acc.name.toUpperCase()}</span>
                    <span className="font-crimson font-light text-[10px] italic mt-0.5 opacity-70">
                      {acc.subtitle.split('·')[0].trim()} · {pct}% done
                    </span>
                  </TabsTrigger>
                )
              })}
            </TabsList>

            {ACCOUNTS.map(acc => (
              <TabsContent key={acc.id} value={acc.id} className="mt-0">
                <AccountPanel
                  account={acc}
                  checked={checked}
                  onToggle={toggleItem}
                  onReset={() => resetAccount(acc)}
                />
              </TabsContent>
            ))}
          </Tabs>

          <p className="text-center text-[10px] text-[var(--arch-text-dim)] italic mt-6 font-light">
            Progress saves automatically in your browser
          </p>
        </div>
      </div>
    </>
  )
}
