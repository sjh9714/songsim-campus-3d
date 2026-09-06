export type Point = [number, number];
export interface BuildingEvidence {
  sourceTitle: string; sourceUrl: string; author: string; limitations: string;
  facts: { aboveGroundFloors?: number; basementFloors?: number; pilotisStoreys?: number };
  model?: { localOutline: Point[]; headCenter: Point; headRadius: number; atriumRadius: number;
    roofHeight: number; headRoomBase: number; wingRoomBase: number; floorHeight: number };
}
export interface Building {
  id: string; number: number; osmId: number; name: string; english: string; code: string;
  kind: string; height: number; floors: number; floorsVerified: boolean; color: string;
  subtitle: string; center: Point; ring: Point[]; holes: Point[][]; annex?: Point[]; siteRing?: Point[];
  latitude: number; longitude: number; photo: string | null; photoSource: string | null;
  sourceNote: string; sourceUrl: string; baseElevation: number;
  architecture?: BuildingEvidence;
}
export interface CampusData {
  origin: { latitude: number; longitude: number; metersPerLongitude: number; metersPerLatitude: number };
  retrievedAt: string; osmTimestamp: string; angle: number; buildings: Building[];
  boundary: Point[];
  roads: { id: number; type: string; name: string; points: Point[] }[];
  grounds: { id: number; kind: string; ring: Point[] }[];
  context: { id: number; ring: Point[]; height: number }[];
  landmarks: { number: number; name: string; position: Point; photo: string; ring?: Point[] }[];
  terrain: { extent: number[]; resolution: number; values: number[]; datum: number; sources: string[] };
  accuracy: Record<string, string>;
}
