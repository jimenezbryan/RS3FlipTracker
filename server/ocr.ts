import Tesseract from "tesseract.js";

interface ExtractedFlipData {
  itemName?: string;
  quantity?: number;
  buyPrice?: number;
  sellPrice?: number;
  buyDate?: string;
  sellDate?: string;
}

export async function extractFlipData(imageBase64: string): Promise<ExtractedFlipData> {
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const imageBuffer = Buffer.from(base64Data, "base64");

  const { data: { text } } = await Tesseract.recognize(
    imageBuffer,
    "eng",
    {
      logger: () => {}
    }
  );

  return parseFlipText(text);
}

function parseFlipText(text: string): ExtractedFlipData {
  const result: ExtractedFlipData = {};
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    const quantityMatch = line.match(/(?:qty|quantity|x|amount)[:\s]*(\d+)/i) ||
                          line.match(/^(\d+)\s*x\s/i) ||
                          line.match(/(\d+)\s*(?:items?|units?)/i);
    if (quantityMatch && !result.quantity) {
      result.quantity = parseInt(quantityMatch[1]);
    }

    const buyPriceMatch = line.match(/(?:buy|bought|purchase)[:\s]*(\d[\d,]*)/i) ||
                          line.match(/(?:bought for|buy price|purchased)[:\s]*(\d[\d,]*)/i);
    if (buyPriceMatch && !result.buyPrice) {
      result.buyPrice = parseInt(buyPriceMatch[1].replace(/,/g, ''));
    }

    const sellPriceMatch = line.match(/(?:sell|sold|sale)[:\s]*(\d[\d,]*)/i) ||
                           line.match(/(?:sold for|sell price|selling)[:\s]*(\d[\d,]*)/i);
    if (sellPriceMatch && !result.sellPrice) {
      result.sellPrice = parseInt(sellPriceMatch[1].replace(/,/g, ''));
    }

    const priceMatch = line.match(/(\d[\d,]*)\s*(?:gp|gold|coins?)/i);
    if (priceMatch) {
      const price = parseInt(priceMatch[1].replace(/,/g, ''));
      if (!result.buyPrice) {
        result.buyPrice = price;
      } else if (!result.sellPrice && price !== result.buyPrice) {
        result.sellPrice = price;
      }
    }

    const dateMatch = line.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (dateMatch) {
      let [, day, month, year] = dateMatch;
      if (year.length === 2) {
        year = '20' + year;
      }
      const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      if (!result.buyDate) {
        result.buyDate = dateStr;
      } else if (!result.sellDate) {
        result.sellDate = dateStr;
      }
    }
  }

  const fullText = lines.join(' ');
  
  const rs3Items = [
    "Abyssal whip", "Dragon claws", "Noxious scythe", "Noxious staff", "Noxious longbow",
    "Ascension crossbow", "Seismic wand", "Seismic singularity", "Drygore rapier",
    "Drygore longsword", "Drygore mace", "Torva platebody", "Torva platelegs",
    "Torva full helm", "Pernix cowl", "Pernix body", "Pernix chaps", "Virtus mask",
    "Virtus robe top", "Virtus robe legs", "Bandos chestplate", "Bandos tassets",
    "Armadyl helmet", "Armadyl chestplate", "Armadyl chainskirt", "Subjugation hood",
    "Subjugation robe top", "Subjugation robe bottom", "Saradomin godsword",
    "Zamorak godsword", "Bandos godsword", "Armadyl godsword", "Spirit shield",
    "Elysian spirit shield", "Arcane spirit shield", "Divine spirit shield",
    "Spectral spirit shield", "Dragon bones", "Frost dragon bones", "Grimy ranarr",
    "Clean ranarr", "Ranarr potion (unf)", "Super restore", "Prayer potion",
    "Saradomin brew", "Rocktail", "Blue charm", "Crimson charm", "Gold charm",
    "Green charm", "Mahogany plank", "Magic logs", "Yew logs", "Elder logs",
    "Runite ore", "Adamantite ore", "Coal", "Onyx", "Dragonstone", "Diamond",
    "Ruby", "Emerald", "Sapphire", "Nature rune", "Death rune", "Blood rune",
    "Soul rune", "Astral rune", "Law rune", "Cosmic rune", "Chaos rune"
  ];

  for (const item of rs3Items) {
    if (fullText.toLowerCase().includes(item.toLowerCase())) {
      result.itemName = item;
      break;
    }
  }

  if (!result.itemName) {
    const itemMatch = fullText.match(/(?:item|name)[:\s]*([A-Za-z][A-Za-z\s]+?)(?:\s*[-\d]|$)/i);
    if (itemMatch) {
      result.itemName = itemMatch[1].trim();
    }
  }

  return result;
}
