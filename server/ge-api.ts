const GE_API_BASE = "https://api.weirdgloop.org/exchange/history/rs";
const RS_ITEMDB_BASE = "https://secure.runescape.com/m=itemdb_rs";

const USER_AGENT = "RS3FlipTracker/1.0 (Replit App)";

export interface GEItem {
  id: number;
  name: string;
  price: number;
  volume?: number;
  timestamp?: string;
  icon?: string;
}

export async function getItemPrice(itemName: string): Promise<GEItem | null> {
  try {
    const response = await fetch(
      `${GE_API_BASE}/latest?name=${encodeURIComponent(itemName)}`,
      {
        headers: {
          "User-Agent": USER_AGENT,
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const keys = Object.keys(data);
    
    if (keys.length === 0) return null;

    const foundName = keys[0];
    const itemData = data[foundName];
    const itemId = itemData.id;

    return {
      id: parseInt(itemId),
      name: foundName,
      price: itemData.price,
      volume: itemData.volume,
      timestamp: itemData.timestamp,
      icon: `${RS_ITEMDB_BASE}/obj_sprite.gif?id=${itemId}`,
    };
  } catch (error) {
    console.error("Failed to fetch GE price:", error);
    return null;
  }
}

export async function searchItems(query: string): Promise<GEItem[]> {
  try {
    const response = await fetch(
      `${GE_API_BASE}/latest?name=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent": USER_AGENT,
        },
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    const items: GEItem[] = [];

    for (const [itemName, itemData] of Object.entries(data)) {
      const item = itemData as any;
      items.push({
        id: parseInt(item.id),
        name: itemName,
        price: item.price,
        volume: item.volume,
        timestamp: item.timestamp,
        icon: `${RS_ITEMDB_BASE}/obj_sprite.gif?id=${item.id}`,
      });
    }

    return items;
  } catch (error) {
    console.error("Failed to search items:", error);
    return [];
  }
}

export async function getItemById(itemId: number): Promise<GEItem | null> {
  try {
    const response = await fetch(
      `${GE_API_BASE}/latest?id=${itemId}`,
      {
        headers: {
          "User-Agent": USER_AGENT,
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const itemData = data[itemId.toString()];
    
    if (!itemData) return null;

    return {
      id: itemId,
      name: itemData.name || `Item ${itemId}`,
      price: itemData.price,
      volume: itemData.volume,
      timestamp: itemData.timestamp,
      icon: `${RS_ITEMDB_BASE}/obj_sprite.gif?id=${itemId}`,
    };
  } catch (error) {
    console.error("Failed to fetch item by ID:", error);
    return null;
  }
}
