// Document registry with static Asset imports for React Native
// This ensures proper bundling with Expo's asset system

import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

// Static imports for all document assets
const emapUsrStandard = require('../../assets/documents/emap_usr_standard.md');
const femaIcsFog2016 = require('../../assets/documents/fema_ics_fog_2016.md');
const femaIncidentRehab2008 = require('../../assets/documents/fema_incident_rehab_2008.md');
const femaUsrFog = require('../../assets/documents/fema_usr_fog.md');
const femaUsrOps = require('../../assets/documents/fema_usr_ops.md');
const insaragCoordination = require('../../assets/documents/insarag_coordination.md');
const tcccHandbookV5 = require('../../assets/documents/tccc_handbook_v5.md');
const tcccQuickRef = require('../../assets/documents/tccc_quick_ref.md');
const usrTpam = require('../../assets/documents/usr_tpam.md');
const whoBlueBook = require('../../assets/documents/who_blue_book.md');
const whoFieldGuideLimbInjuries = require('../../assets/documents/who_field_guide_limb_injuries.md');
const whoHighlyInfectiousResponse = require('../../assets/documents/who_highly_infectious_response.md');
const whoInjurySurveillance = require('../../assets/documents/who_injury_surveillance.md');
const whoMedicalEvacuation2025 = require('../../assets/documents/who_medical_evacuation_2025.md');
const whoPocketBook = require('../../assets/documents/who_pocket_book.md');
const whoPrehospitalTrauma = require('../../assets/documents/who_prehospital_trauma.md');

export const documentsRegistry = {
  'emap_usr_standard.md': emapUsrStandard,
  'fema_ics_fog_2016.md': femaIcsFog2016,
  'fema_incident_rehab_2008.md': femaIncidentRehab2008,
  'fema_usr_fog.md': femaUsrFog,
  'fema_usr_ops.md': femaUsrOps,
  'insarag_coordination.md': insaragCoordination,
  'tccc_handbook_v5.md': tcccHandbookV5,
  'tccc_quick_ref.md': tcccQuickRef,
  'usr_tpam.md': usrTpam,
  'who_blue_book.md': whoBlueBook,
  'who_field_guide_limb_injuries.md': whoFieldGuideLimbInjuries,
  'who_highly_infectious_response.md': whoHighlyInfectiousResponse,
  'who_injury_surveillance.md': whoInjurySurveillance,
  'who_medical_evacuation_2025.md': whoMedicalEvacuation2025,
  'who_pocket_book.md': whoPocketBook,
  'who_prehospital_trauma.md': whoPrehospitalTrauma
} as Record<string, any>;

export const documentsList = Object.keys(documentsRegistry);

// Helper function to load document content
export async function loadDocumentAsset(filename: string): Promise<string | null> {
  const assetModule = documentsRegistry[filename];
  if (!assetModule) {
    console.warn(`Document not found in registry: ${filename}`);
    return null;
  }

  try {
    const asset = Asset.fromModule(assetModule);
    await asset.downloadAsync();
    
    if (asset.localUri) {
      const content = await FileSystem.readAsStringAsync(asset.localUri);
      console.log(`Successfully loaded ${filename} from assets: ${content.length} chars`);
      return content;
    } else {
      console.warn(`Asset has no local URI: ${filename}`);
      return null;
    }
  } catch (error) {
    console.error(`Failed to load asset ${filename}:`, error);
    return null;
  }
}