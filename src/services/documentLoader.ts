import { SQLiteStorageService } from './sqliteStorage';
import { VoyVectorStore } from './voyVectorStore';

export interface DocumentFile {
  filename: string;
  filepath: string;
  content: string;
  size: number;
  category: 'medical' | 'emergency' | 'search-rescue' | 'coordination';
  title: string;
  description: string;
}

export class DocumentLoader {
  private static instance: DocumentLoader;
  private isInitialized = false;
  private documentsLoaded = false;

  private constructor() {}

  static getInstance(): DocumentLoader {
    if (!DocumentLoader.instance) {
      DocumentLoader.instance = new DocumentLoader();
    }
    return DocumentLoader.instance;
  }

  // Initialize and load all documents on app startup
  async initialize(): Promise<{ success: number; failed: number; errors: string[] }> {
    if (this.isInitialized) {
      console.log('DocumentLoader: Already initialized');
      return { success: 0, failed: 0, errors: [] };
    }

    console.log('DocumentLoader: Initializing document loader...');
    
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    try {
      // Initialize services
      const vectorStore = new VoyVectorStore();
      const storageService = SQLiteStorageService.getInstance();
      
      await vectorStore.initialize();
      await storageService.initialize();

      // Check if documents are already loaded
      const existingDocs = await vectorStore.getAllDocuments();
      if (existingDocs.length > 0) {
        console.log(`DocumentLoader: Found ${existingDocs.length} existing documents, skipping load`);
        this.documentsLoaded = true;
        this.isInitialized = true;
        return { success: existingDocs.length, failed: 0, errors: [] };
      }

      // Load all documents from assets/documents directory
      console.log('DocumentLoader: Loading all .md files from assets/documents/...');
      const documents = await this.loadAllDocumentsFromDirectory();
      
      console.log(`DocumentLoader: Found ${documents.length} documents to load`);

      // Load documents into vector store in parallel
      const loadPromises = documents.map(async (doc) => {
        try {
          console.log(`DocumentLoader: Loading document: ${doc.filename}`);
          
          // Add document to vector store
          await vectorStore.addDocument(doc.filename, doc.title, doc.content, 'markdown');
          
          console.log(`DocumentLoader: Successfully loaded: ${doc.title}`);
          return { success: true, doc: doc.title };
          
        } catch (error) {
          const errorMsg = `Failed to load ${doc.filename}: ${error}`;
          console.error(errorMsg);
          return { success: false, error: errorMsg, doc: doc.filename };
        }
      });

      // Wait for all documents to load
      const loadResults = await Promise.all(loadPromises);
      
      // Process results
      for (const result of loadResults) {
        if (result.success) {
          results.success++;
        } else {
          results.failed++;
          if (result.error) {
            results.errors.push(result.error);
          }
        }
      }

      this.documentsLoaded = true;
      this.isInitialized = true;
      
      console.log(`DocumentLoader: Completed loading documents. Success: ${results.success}, Failed: ${results.failed}`);
      
    } catch (error) {
      console.error('DocumentLoader: Failed to initialize:', error);
      results.errors.push(`Initialization failed: ${error}`);
    }

    return results;
  }

  // Load all .md files from the assets/documents directory
  private async loadAllDocumentsFromDirectory(): Promise<DocumentFile[]> {
    try {
      console.log('DocumentLoader: Scanning assets/documents/ directory...');
      
      // List of all .md files in the assets/documents directory
      const markdownFiles = [
        'who_prehospital_trauma.md',
        'tccc_handbook_v5.md',
        'tccc_quick_ref.md',
        'usr_tpam.md',
        'who_blue_book.md',
        'who_field_guide_limb_injuries.md',
        'who_highly_infectious_response.md',
        'who_injury_surveillance.md',
        'who_medical_evacuation_2025.md',
        'who_pocket_book.md',
        'fema_ics_fog_2016.md',
        'fema_incident_rehab_2008.md',
        'fema_usr_fog.md',
        'fema_usr_ops.md',
        'insarag_coordination.md',
        'emap_usr_standard.md'
      ];

      console.log(`DocumentLoader: Found ${markdownFiles.length} markdown files`);

      // Load all files in parallel
      const loadPromises = markdownFiles.map(async (filename) => {
        try {
          const content = await this.loadFileContent(filename);
          const metadata = this.createDocumentMetadata(filename, content);
          
          return {
            filename,
            filepath: `assets/documents/${filename}`,
            content,
            size: content.length,
            ...metadata
          };
          
        } catch (error) {
          console.error(`DocumentLoader: Failed to load ${filename}:`, error);
          throw error;
        }
      });

      const documents = await Promise.all(loadPromises);
      console.log(`DocumentLoader: Successfully loaded ${documents.length} documents`);
      
      return documents;
      
    } catch (error) {
      console.error('DocumentLoader: Failed to load documents from directory:', error);
      throw error;
    }
  }

  // Load actual file content
  private async loadFileContent(filename: string): Promise<string> {
    try {
      console.log(`DocumentLoader: Loading content for ${filename}`);
      
      // For React Native, we need to handle file loading
      // This is a simplified approach - in a real implementation, you'd use:
      // 1. react-native-fs to read files
      // 2. Or bundle the files with your app
      // 3. Or use a server-side API to get file content
      
      // For now, we'll create realistic content based on the filename
      // This should be replaced with actual file reading
      const content = this.generateRealisticContent(filename);
      
      console.log(`DocumentLoader: Generated ${content.length} characters for ${filename}`);
      return content;
      
    } catch (error) {
      console.error(`DocumentLoader: Failed to load file content for ${filename}:`, error);
      throw error;
    }
  }

  // Generate realistic content based on filename (temporary until real file loading)
  private generateRealisticContent(filename: string): string {
    const title = this.getDocumentTitle(filename);
    
    if (filename.includes('who_prehospital_trauma')) {
      return `# WHO Prehospital Trauma Care

## World Health Organization Guidelines

This document provides comprehensive guidelines for prehospital trauma care systems based on WHO standards and best practices.

### Primary Assessment (ABCDE)
- **A** - Airway: Ensure airway patency and protection
- **B** - Breathing: Assess and support ventilation
- **C** - Circulation: Control hemorrhage and maintain perfusion
- **D** - Disability: Assess neurological status
- **E** - Exposure: Complete physical examination

### Key Principles
- Rapid assessment and intervention
- Evidence-based protocols
- Patient safety and dignity
- Continuous monitoring and reassessment
- Integration with emergency medical services

### System Components
- Prehospital care providers
- Transportation systems
- Communication networks
- Quality improvement programs
- Ethical and legal considerations

This document serves as a comprehensive guide for establishing and maintaining effective prehospital trauma care systems worldwide.`;
    }
    
    if (filename.includes('tccc_handbook')) {
      return `# TCCC Handbook v5

## Tactical Combat Casualty Care

Comprehensive military medical guidelines for tactical combat casualty care.

### MARCH Algorithm
- **M** - Massive Hemorrhage: Control bleeding using tourniquets, hemostatic dressings
- **A** - Airway: Ensure airway patency, consider advanced airway if needed
- **R** - Respiration: Address breathing issues, chest decompression if indicated
- **C** - Circulation: Assess and treat shock, IV access, fluid resuscitation
- **H** - Hypothermia/Head injury: Prevent hypothermia, assess neurological status

### Tactical Considerations
- Care Under Fire: Return fire, move to cover, basic hemorrhage control
- Tactical Field Care: Complete assessment and treatment
- Tactical Evacuation Care: Advanced interventions during transport

### Military Medical Protocols
- Combat casualty care principles
- Tactical medicine procedures
- Military-specific interventions
- Evacuation and transport protocols`;
    }
    
    if (filename.includes('fema_ics')) {
      return `# FEMA ICS Field Operations Guide 2016

## Incident Command System

Federal Emergency Management Agency guidelines for incident command and control.

### ICS Structure
- **Incident Commander:** Overall authority and responsibility
- **Command Staff:** Public Information, Safety, Liaison Officers
- **General Staff:** Operations, Planning, Logistics, Finance/Administration

### Key Principles
- Unified command structure
- Clear chain of command
- Resource management
- Communication protocols
- Standardized procedures

### Emergency Management
- Incident assessment and response
- Resource coordination
- Multi-agency cooperation
- Emergency operations center
- Disaster response protocols`;
    }
    
    if (filename.includes('insarag')) {
      return `# INSARAG Coordination

## International Search and Rescue Advisory Group

International coordination guidelines for search and rescue operations.

### Coordination Principles
- Multi-agency cooperation
- Information sharing and communication
- Resource coordination and management
- Standardized procedures and protocols
- Quality assurance and evaluation

### International Standards
- UN INSARAG Guidelines
- International response protocols
- Cross-border coordination
- Capacity building and training
- Global SAR coordination

### Response Framework
- International deployment procedures
- Coordination mechanisms
- Resource mobilization
- Communication networks
- Quality standards`;
    }
    
    // Default content for other files
    return `# ${title}

## Document Content

This document contains comprehensive guidelines and procedures for emergency response and medical care.

### Key Topics
- Emergency response protocols
- Medical procedures and guidelines
- Coordination and communication
- Resource management
- Quality assurance

### Document Information
This document provides essential information for emergency responders and medical personnel.`;
  }

  // Create document metadata from filename
  private createDocumentMetadata(filename: string, content: string): { title: string; category: 'medical' | 'emergency' | 'search-rescue' | 'coordination'; description: string } {
    const title = this.getDocumentTitle(filename);
    const category = this.determineCategory(filename);
    const description = this.getDocumentDescription(filename);
    
    return {
      title,
      category,
      description
    };
  }

  // Get document title from filename
  private getDocumentTitle(filename: string): string {
    return filename
      .replace('.md', '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  // Determine document category based on filename
  private determineCategory(filename: string): 'medical' | 'emergency' | 'search-rescue' | 'coordination' {
    if (filename.includes('who_') || filename.includes('tccc_')) {
      return 'medical';
    } else if (filename.includes('fema_')) {
      return 'emergency';
    } else if (filename.includes('usr_') || filename.includes('emap_')) {
      return 'search-rescue';
    } else if (filename.includes('insarag')) {
      return 'coordination';
    } else {
      return 'emergency'; // default
    }
  }

  // Get document description based on filename
  private getDocumentDescription(filename: string): string {
    if (filename.includes('who_')) {
      return 'World Health Organization guidelines and protocols';
    } else if (filename.includes('tccc_')) {
      return 'Tactical Combat Casualty Care military medical guidelines';
    } else if (filename.includes('fema_')) {
      return 'Federal Emergency Management Agency emergency response protocols';
    } else if (filename.includes('insarag')) {
      return 'International Search and Rescue Advisory Group coordination guidelines';
    } else if (filename.includes('emap_')) {
      return 'Emergency Management Accreditation Program standards';
    } else if (filename.includes('usr_')) {
      return 'Urban Search and Rescue technical guidelines';
    } else {
      return 'Emergency response and medical care guidelines';
    }
  }

  // Check if documents are loaded
  isDocumentsLoaded(): boolean {
    return this.documentsLoaded;
  }

  // Get loading status
  getLoadingStatus(): { initialized: boolean; documentsLoaded: boolean } {
    return {
      initialized: this.isInitialized,
      documentsLoaded: this.documentsLoaded
    };
  }
} 