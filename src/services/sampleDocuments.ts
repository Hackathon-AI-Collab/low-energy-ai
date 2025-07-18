export interface SampleDocument {
  id: string;
  title: string;
  type: string;
  content: string;
}

export class SampleDocumentService {
  private static documents: SampleDocument[] = [
    {
      id: 'tccc-guidelines',
      title: 'TCCC Guidelines',
      type: 'markdown',
      content: `
# Tactical Combat Casualty Care (TCCC) Guidelines

## MARCH Algorithm

### M - Massive Hemorrhage
- Apply tourniquets for extremity bleeding
- Use hemostatic dressings for junctional bleeding
- Pack wounds with gauze for compressible bleeding

### A - Airway
- Check for airway obstruction
- Use jaw thrust maneuver
- Consider nasopharyngeal airway
- Cricothyrotomy as last resort

### R - Respiration
- Check for tension pneumothorax
- Needle decompression if needed
- Seal open chest wounds
- Monitor respiratory rate

### C - Circulation
- Check radial pulse
- Control bleeding
- IV/IO access if needed
- Monitor mental status

### H - Hypothermia/Head Injury
- Prevent hypothermia
- Check for head injury
- Monitor Glasgow Coma Scale
- Protect cervical spine

## Tourniquet Application
1. Place 2-3 inches above wound
2. Tighten until bleeding stops
3. Secure in place
4. Mark time of application
5. Do not remove in field

## Hemostatic Dressings
- Apply direct pressure
- Pack wound completely
- Hold pressure for 3 minutes
- Secure dressing in place
      `
    },
    {
      id: 'search-rescue',
      title: 'Search and Rescue Procedures',
      type: 'markdown',
      content: `
# Search and Rescue (SAR) Procedures

## Scene Safety Assessment
1. Evaluate structural stability
2. Check for hazardous materials
3. Assess environmental conditions
4. Identify escape routes
5. Establish safety zones

## Incident Command Structure
- Incident Commander
- Safety Officer
- Operations Chief
- Planning Chief
- Logistics Chief

## Size-Up Process
1. 360-degree assessment
2. Identify building type and construction
3. Check for fire extension
4. Assess occupant load
5. Determine rescue priorities

## Search Patterns
### Primary Search
- Quick, systematic search
- Mark searched areas
- Use standard patterns
- Document findings

### Secondary Search
- More thorough search
- Use different team
- Check hidden areas
- Verify primary search

## Marking Systems
- X in circle: Area searched
- Single slash: Primary search complete
- Double slash: Secondary search complete
- V: Victim found
- 0: No victims found

## Victim Assessment
1. Check responsiveness
2. Assess airway
3. Check breathing
4. Evaluate circulation
5. Look for disabilities
6. Expose and examine

## Rescue Techniques
- Drag rescue for immediate danger
- Carry rescue for medical emergency
- Technical rescue for complex situations
- Use appropriate equipment
- Maintain victim stability
      `
    },
    {
      id: 'medical-equipment',
      title: 'Medical Equipment Guide',
      type: 'markdown',
      content: `
# Medical Equipment Guide

## Tourniquets
### CAT Tourniquet
- Combat Application Tourniquet
- One-handed application
- Windlass mechanism
- Time indicator

### SOF-T Tourniquet
- Special Operations Forces Tourniquet
- Elastic design
- Multiple applications
- Lightweight

## Hemostatic Agents
### QuikClot
- Kaolin-based
- Activates clotting cascade
- 3-minute application time
- Single-use

### Celox
- Chitosan-based
- Works with any blood type
- 2-minute application time
- Granular or gauze form

## Airway Management
### Nasopharyngeal Airway
- Flexible tube
- Lubricate before insertion
- Measure from nostril to earlobe
- Insert gently

### Oropharyngeal Airway
- Rigid plastic
- Measure from corner of mouth to earlobe
- Insert upside down, then rotate
- Use only in unconscious patients

## Monitoring Equipment
### Pulse Oximeter
- Measures oxygen saturation
- Normal range: 95-100%
- Below 90% indicates hypoxia
- Check capillary refill

### Blood Pressure Cuff
- Manual or automatic
- Normal systolic: 90-140 mmHg
- Normal diastolic: 60-90 mmHg
- Check both arms if possible
      `
    }
  ];

  static getAllDocuments(): SampleDocument[] {
    return this.documents;
  }

  static getDocumentById(id: string): SampleDocument | undefined {
    return this.documents.find(doc => doc.id === id);
  }

  static getDocumentTitles(): string[] {
    return this.documents.map(doc => doc.title);
  }
} 