import { SampleDocumentService } from './sampleDocuments';

export class SimpleRAG {
  private documents: any[] = [];

  async initialize() {
    try {
      console.log('Initializing Simple RAG...');
      this.documents = SampleDocumentService.getAllDocuments();
      console.log(`Loaded ${this.documents.length} documents`);
    } catch (error) {
      console.error('Failed to initialize Simple RAG:', error);
      throw error;
    }
  }

  async processQuery(query: string): Promise<string> {
    try {
      console.log('Processing query:', query);
      
      // Simple keyword-based search
      const relevantDocs = this.findRelevantDocuments(query);
      
      if (relevantDocs.length === 0) {
        return `I don't have specific information about "${query}". However, I can help you with medical guidelines (TCCC), search and rescue procedures, and medical equipment information. Please try asking about these topics.`;
      }
      
      // Generate response based on relevant documents
      const response = this.generateResponse(query, relevantDocs);
      
      console.log('Generated response:', response);
      return response;
    } catch (error) {
      console.error('Simple RAG error:', error);
      return 'Sorry, I encountered an error processing your query. Please try again.';
    }
  }

  private findRelevantDocuments(query: string): any[] {
    const lowerQuery = query.toLowerCase();
    const relevantDocs: any[] = [];
    
    for (const doc of this.documents) {
      let score = 0;
      
      // Check title relevance
      if (doc.title.toLowerCase().includes(lowerQuery)) {
        score += 10;
      }
      
      // Check content relevance
      const content = doc.content.toLowerCase();
      const queryWords = lowerQuery.split(' ');
      
      for (const word of queryWords) {
        if (word.length > 2 && content.includes(word)) {
          score += 1;
        }
      }
      
      // Special handling for medical/TCCC queries
      if ((lowerQuery.includes('medical') || lowerQuery.includes('tccc') || lowerQuery.includes('march')) && 
          doc.id === 'tccc-guidelines') {
        score += 20;
      }
      
      // Special handling for search/rescue queries
      if ((lowerQuery.includes('search') || lowerQuery.includes('rescue') || lowerQuery.includes('sar')) && 
          doc.id === 'search-rescue') {
        score += 20;
      }
      
      // Special handling for equipment queries
      if ((lowerQuery.includes('equipment') || lowerQuery.includes('tourniquet') || lowerQuery.includes('airway')) && 
          doc.id === 'medical-equipment') {
        score += 20;
      }
      
      if (score > 0) {
        relevantDocs.push({ ...doc, score });
      }
    }
    
    // Sort by relevance score
    relevantDocs.sort((a, b) => b.score - a.score);
    
    return relevantDocs.slice(0, 2); // Return top 2 most relevant
  }

  private generateResponse(query: string, relevantDocs: any[]): string {
    const lowerQuery = query.toLowerCase();
    
    // Generate specific responses based on the most relevant document
    const topDoc = relevantDocs[0];
    
    if (topDoc.id === 'tccc-guidelines') {
      if (lowerQuery.includes('march')) {
        return `The MARCH algorithm is the foundation of Tactical Combat Casualty Care:

M - Massive Hemorrhage: Apply tourniquets for extremity bleeding, use hemostatic dressings for junctional bleeding, pack wounds with gauze for compressible bleeding.

A - Airway: Check for airway obstruction, use jaw thrust maneuver, consider nasopharyngeal airway, cricothyrotomy as last resort.

R - Respiration: Check for tension pneumothorax, needle decompression if needed, seal open chest wounds, monitor respiratory rate.

C - Circulation: Check radial pulse, control bleeding, IV/IO access if needed, monitor mental status.

H - Hypothermia/Head Injury: Prevent hypothermia, check for head injury, monitor Glasgow Coma Scale, protect cervical spine.`;
      } else if (lowerQuery.includes('tourniquet')) {
        return `Tourniquet Application (TCCC Guidelines):
1. Place 2-3 inches above wound
2. Tighten until bleeding stops
3. Secure in place
4. Mark time of application
5. Do not remove in field

For massive hemorrhage control, tourniquets are the first priority in the MARCH algorithm.`;
      } else {
        return `Based on TCCC guidelines, immediate attention should be given to massive hemorrhage control using tourniquets for extremity bleeding. Always follow the MARCH algorithm: Massive hemorrhage, Airway, Respiration, Circulation, Hypothermia/Head injury.

For specific procedures, ask about MARCH, tourniquet application, or hemostatic dressings.`;
      }
    } else if (topDoc.id === 'search-rescue') {
      if (lowerQuery.includes('size-up')) {
        return `Size-Up Process for Search and Rescue:
1. 360-degree assessment
2. Identify building type and construction
3. Check for fire extension
4. Assess occupant load
5. Determine rescue priorities

Scene safety is always the first priority before any rescue operations.`;
      } else if (lowerQuery.includes('search pattern')) {
        return `Search Patterns for SAR Operations:

Primary Search:
- Quick, systematic search
- Mark searched areas
- Use standard patterns
- Document findings

Secondary Search:
- More thorough search
- Use different team
- Check hidden areas
- Verify primary search

Marking Systems:
- X in circle: Area searched
- Single slash: Primary search complete
- Double slash: Secondary search complete
- V: Victim found
- 0: No victims found`;
      } else {
        return `For search and rescue operations, ensure scene safety first, establish incident command, and conduct a systematic size-up of the structure. Use systematic search patterns and mark searched areas appropriately.

Ask about size-up process, search patterns, or marking systems for more details.`;
      }
    } else if (topDoc.id === 'medical-equipment') {
      if (lowerQuery.includes('tourniquet')) {
        return `Medical Equipment - Tourniquets:

CAT Tourniquet:
- Combat Application Tourniquet
- One-handed application
- Windlass mechanism
- Time indicator

SOF-T Tourniquet:
- Special Operations Forces Tourniquet
- Elastic design
- Multiple applications
- Lightweight

Place 2-3 inches above wound, tighten until bleeding stops, secure in place, and mark time of application.`;
      } else if (lowerQuery.includes('airway')) {
        return `Airway Management Equipment:

Nasopharyngeal Airway:
- Flexible tube
- Lubricate before insertion
- Measure from nostril to earlobe
- Insert gently

Oropharyngeal Airway:
- Rigid plastic
- Measure from corner of mouth to earlobe
- Insert upside down, then rotate
- Use only in unconscious patients`;
      } else {
        return `Medical Equipment Guide includes:

Tourniquets (CAT, SOF-T)
Hemostatic Agents (QuikClot, Celox)
Airway Management (Nasopharyngeal, Oropharyngeal)
Monitoring Equipment (Pulse Oximeter, Blood Pressure Cuff)

Ask about specific equipment for detailed information.`;
      }
    }
    
    // Fallback response
    return `I found relevant information about "${query}" in our knowledge base. The most relevant document is "${topDoc.title}". Please ask more specific questions about this topic for detailed information.`;
  }

  getStats() {
    return {
      documents: this.documents.length,
      chunks: this.documents.reduce((total, doc) => total + Math.ceil(doc.content.length / 500), 0)
    };
  }
} 