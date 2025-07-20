import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { loadDocumentAsset } from './documentsRegistry';

export interface DocumentInfo {
  filename: string;
  title: string;
  size: number;
  lastModified?: Date;
}

export class DynamicDocumentLoader {
  private static instance: DynamicDocumentLoader;
  private documentCache: Map<string, string> = new Map();
  private documentList: DocumentInfo[] = [];
  private isInitialized = false;
  
  // Known documents that should be available in the app bundle
  private knownDocuments: string[] = [
    'emap_usr_standard.md',
    'fema_ics_fog_2016.md', 
    'fema_incident_rehab_2008.md',
    'fema_usr_fog.md',
    'fema_usr_ops.md',
    'insarag_coordination.md',
    'tccc_handbook_v5.md',
    'tccc_quick_ref.md',
    'usr_tpam.md',
    'who_blue_book.md',
    'who_field_guide_limb_injuries.md',
    'who_highly_infectious_response.md',
    'who_injury_surveillance.md',
    'who_medical_evacuation_2025.md',
    'who_pocket_book.md',
    'who_prehospital_trauma.md'
  ];

  private constructor() {}

  static getInstance(): DynamicDocumentLoader {
    if (!DynamicDocumentLoader.instance) {
      DynamicDocumentLoader.instance = new DynamicDocumentLoader();
    }
    return DynamicDocumentLoader.instance;
  }

  // Initialize by scanning the documents directory
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('DynamicDocumentLoader: Initializing...');
      
      // Scan for available documents
      await this.scanDocumentsDirectory();
      
      this.isInitialized = true;
      console.log(`DynamicDocumentLoader: Initialized with ${this.documentList.length} documents`);
      
    } catch (error) {
      console.error('DynamicDocumentLoader: Failed to initialize:', error);
      // Continue with empty document list - graceful degradation
      this.isInitialized = true;
    }
  }

  // Scan the documents directory to find all available files
  private async scanDocumentsDirectory(): Promise<void> {
    try {
      console.log('DynamicDocumentLoader: Initializing with known documents list...');
      
      this.documentList = [];
      
      // For React Native, we can't scan directories dynamically
      // Instead, use the known documents list and add them all
      for (const filename of this.knownDocuments) {
        this.documentList.push({
          filename,
          title: this.generateTitleFromFilename(filename),
          size: 0, // Will be determined when loaded
          lastModified: undefined
        });
        
        console.log(`DynamicDocumentLoader: Added known document: ${filename}`);
      }

      console.log(`DynamicDocumentLoader: Initialized with ${this.documentList.length} documents`);

    } catch (error) {
      console.error('DynamicDocumentLoader: Initialization failed:', error);
      // Still provide the known documents even if initialization fails
      this.documentList = this.knownDocuments.map(filename => ({
        filename,
        title: this.generateTitleFromFilename(filename),
        size: 0,
        lastModified: undefined
      }));
      console.log(`DynamicDocumentLoader: Fallback to ${this.documentList.length} known documents`);
    }
  }

  // Fallback method - scan for known files individually
  private async scanKnownFiles(): Promise<void> {
    const knownFiles = [
      'tccc_handbook_v5.md',
      'tccc_quick_ref.md',
      'who_prehospital_trauma.md',
      'who_blue_book.md',
      'who_pocket_book.md',
      'who_field_guide_limb_injuries.md',
      'who_highly_infectious_response.md',
      'who_injury_surveillance.md',
      'who_medical_evacuation_2025.md',
      'fema_ics_fog_2016.md',
      'fema_incident_rehab_2008.md',
      'fema_usr_fog.md',
      'fema_usr_ops.md',
      'insarag_coordination.md',
      'emap_usr_standard.md',
      'usr_tpam.md'
    ];

    console.log('DynamicDocumentLoader: Checking known files individually...');

    for (const filename of knownFiles) {
      try {
        // Try bundle directory first
        const bundlePath = `${FileSystem.bundleDirectory}assets/documents/${filename}`;
        let fileInfo = await FileSystem.getInfoAsync(bundlePath);
        
        if (!fileInfo.exists) {
          // Try document directory
          const docPath = `${FileSystem.documentDirectory}assets/documents/${filename}`;
          fileInfo = await FileSystem.getInfoAsync(docPath);
        }

        if (fileInfo.exists) {
          this.documentList.push({
            filename,
            title: this.generateTitleFromFilename(filename),
            size: fileInfo.size || 0,
            lastModified: fileInfo.modificationTime ? new Date(fileInfo.modificationTime) : undefined
          });
          
          console.log(`DynamicDocumentLoader: Found known file: ${filename}`);
        }
      } catch (error) {
        console.warn(`DynamicDocumentLoader: Failed to check ${filename}:`, error);
      }
    }
  }

  // Generate a readable title from filename
  private generateTitleFromFilename(filename: string): string {
    return filename
      .replace('.md', '')
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Get list of available documents
  async getAvailableDocuments(): Promise<DocumentInfo[]> {
    await this.initialize();
    return [...this.documentList];
  }

  // Load a specific document by filename
  async loadDocument(filename: string): Promise<string> {
    await this.initialize();

    try {
      console.log(`DynamicDocumentLoader: Loading document: ${filename}`);

      // Check cache first
      if (this.documentCache.has(filename)) {
        const cached = this.documentCache.get(filename)!;
        console.log(`DynamicDocumentLoader: Using cached content for ${filename} (${cached.length} chars)`);
        return cached;
      }

      let content: string | null = null;

      // Try to load from bundled assets first (using registry)
      try {
        console.log(`DynamicDocumentLoader: Trying to load ${filename} from asset registry`);
        content = await loadDocumentAsset(filename);
        
        if (content) {
          console.log(`DynamicDocumentLoader: Loaded from asset registry: ${filename} (${content.length} chars)`);
        } else {
          console.warn(`DynamicDocumentLoader: Failed to load from asset registry: ${filename}`);
        }
      } catch (assetError) {
        console.warn(`DynamicDocumentLoader: Asset registry loading failed for ${filename}:`, assetError);
      }

      // Try bundle directory if registry failed
      if (!content) {
        try {
          const bundlePath = `${FileSystem.bundleDirectory}assets/documents/${filename}`;
          const fileInfo = await FileSystem.getInfoAsync(bundlePath);
          
          if (fileInfo.exists) {
            content = await FileSystem.readAsStringAsync(bundlePath);
            console.log(`DynamicDocumentLoader: Loaded from bundle: ${filename} (${content.length} chars)`);
          }
        } catch (bundleError) {
          console.warn(`DynamicDocumentLoader: Bundle loading failed for ${filename}:`, bundleError);
        }
      }

      // Try document directory if bundle failed
      if (!content) {
        try {
          const docPath = `${FileSystem.documentDirectory}assets/documents/${filename}`;
          const fileInfo = await FileSystem.getInfoAsync(docPath);
          
          if (fileInfo.exists) {
            content = await FileSystem.readAsStringAsync(docPath);
            console.log(`DynamicDocumentLoader: Loaded from documents: ${filename} (${content.length} chars)`);
          }
        } catch (docError) {
          console.warn(`DynamicDocumentLoader: Document directory loading failed for ${filename}:`, docError);
        }
      }

      // Final fallback: Generate placeholder content if all loading methods fail
      if (!content) {
        console.warn(`DynamicDocumentLoader: All loading methods failed for ${filename}, generating placeholder content`);
        
        // Create meaningful placeholder content based on filename
        const title = this.generateTitleFromFilename(filename);
        const category = this.determineCategoryFromFilename(filename);
        
        content = this.generatePlaceholderContent(filename, title, category);
        console.log(`DynamicDocumentLoader: Generated placeholder content for ${filename} (${content.length} chars)`);
      }

      if (!content) {
        throw new Error(`Unable to load document: ${filename}`);
      }

      // Validate content
      if (content.length < 50) {
        throw new Error(`Document ${filename} appears to be empty or too short (${content.length} chars)`);
      }

      // Cache the loaded content
      this.documentCache.set(filename, content);
      console.log(`DynamicDocumentLoader: Successfully loaded and cached ${filename}: ${content.length} characters`);
      
      return content;

    } catch (error) {
      console.error(`DynamicDocumentLoader: Failed to load ${filename}:`, error);
      throw error;
    }
  }

  // Refresh the document list (useful for sync feature later)
  async refreshDocuments(): Promise<void> {
    console.log('DynamicDocumentLoader: Refreshing document list...');
    this.documentList = [];
    this.isInitialized = false;
    await this.initialize();
  }

  // Clear cache
  clearCache(): void {
    this.documentCache.clear();
    console.log('DynamicDocumentLoader: Cache cleared');
  }

  // Get cache statistics
  getCacheStats(): { size: number; files: string[]; totalSize: number } {
    let totalSize = 0;
    for (const content of this.documentCache.values()) {
      totalSize += content.length;
    }

    return {
      size: this.documentCache.size,
      files: Array.from(this.documentCache.keys()),
      totalSize
    };
  }

  // Check if a document exists
  async documentExists(filename: string): Promise<boolean> {
    await this.initialize();
    return this.documentList.some(doc => doc.filename === filename);
  }

  // Get document info without loading content
  async getDocumentInfo(filename: string): Promise<DocumentInfo | null> {
    await this.initialize();
    return this.documentList.find(doc => doc.filename === filename) || null;
  }

  // Determine document category from filename
  private determineCategoryFromFilename(filename: string): string {
    if (filename.includes('who_')) return 'WHO Medical';
    if (filename.includes('tccc_')) return 'TCCC Medical';
    if (filename.includes('fema_')) return 'FEMA Emergency';
    if (filename.includes('insarag_')) return 'INSARAG Coordination';
    if (filename.includes('usr_') || filename.includes('emap_')) return 'Search & Rescue';
    return 'Emergency Response';
  }

  // Generate meaningful placeholder content when asset loading fails
  private generatePlaceholderContent(filename: string, title: string, category: string): string {
    const sections = [
      `# ${title}`,
      '',
      `**Document Type:** ${category}`,
      `**Source File:** ${filename}`,
      '',
      '## Overview',
      '',
      `This is a ${category.toLowerCase()} document that provides essential information and guidelines for emergency response operations.`,
      '',
      '## Key Topics',
      '',
      category === 'WHO Medical' ? [
        '- Medical treatment protocols',
        '- Patient assessment procedures', 
        '- Emergency medical interventions',
        '- Health system coordination',
        '- Medical supply management'
      ].join('\n') :
      category === 'TCCC Medical' ? [
        '- Tactical Combat Casualty Care',
        '- Hemorrhage control procedures',
        '- Airway management',
        '- Shock prevention and treatment',
        '- Medical evacuation protocols'
      ].join('\n') :
      category === 'FEMA Emergency' ? [
        '- Incident Command System (ICS)',
        '- Emergency response coordination',
        '- Resource management',
        '- Communication protocols',
        '- Multi-agency operations'
      ].join('\n') :
      category === 'Search & Rescue' ? [
        '- Search and rescue operations',
        '- Technical rescue procedures',
        '- Equipment and safety protocols',
        '- Team coordination',
        '- Risk assessment'
      ].join('\n') : [
        '- Emergency response procedures',
        '- Coordination protocols',
        '- Safety guidelines',
        '- Operational procedures',
        '- Best practices'
      ].join('\n'),
      '',
      '## Important Note',
      '',
      '⚠️ This is placeholder content generated because the original document could not be loaded from the app assets. For complete information, ensure the markdown files are properly bundled with the application.',
      '',
      '## Document Information',
      '',
      `- **Filename:** ${filename}`,
      `- **Category:** ${category}`,
      `- **Status:** Placeholder content (original file not accessible)`,
      `- **Generated:** ${new Date().toISOString()}`,
      '',
      '---',
      '',
      '*This placeholder ensures the application continues to function while providing meaningful context about the missing document.*'
    ];
    
    return sections.join('\n');
  }

  // Load all documents (useful for bulk operations)
  async loadAllDocuments(): Promise<Map<string, string>> {
    await this.initialize();
    
    const results = new Map<string, string>();
    
    console.log(`DynamicDocumentLoader: Loading all ${this.documentList.length} documents...`);
    
    for (const docInfo of this.documentList) {
      try {
        const content = await this.loadDocument(docInfo.filename);
        results.set(docInfo.filename, content);
        console.log(`DynamicDocumentLoader: Loaded ${docInfo.filename} (${content.length} chars)`);
      } catch (error) {
        console.error(`DynamicDocumentLoader: Failed to load ${docInfo.filename}:`, error);
        // Continue with other documents
      }
    }
    
    console.log(`DynamicDocumentLoader: Loaded ${results.size}/${this.documentList.length} documents`);
    return results;
  }
}