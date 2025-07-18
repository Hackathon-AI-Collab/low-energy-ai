
# Low-Energy AI (LEAI) Platform

## 1. Vision & Mission

**Vision:** To create a decentralized, resilient, and low-power AI platform that delivers critical knowledge and communication capabilities to individuals in the world's most challenging environments, including disaster zones and conflict areas.

**Mission:** To build a mobile-first application using React Native that runs an offline-capable Large Language Model (LLM) augmented by a dynamic, peer-to-peer synchronized knowledge base. The system will prioritize low power consumption, a minimal detection signature (via BLE), and operational effectiveness in disconnected settings.

---

## 2. Core Use Cases

### Primary (Information Retrieval)
1.  **Field Medicine & Triage:** Provide immediate, authoritative medical guidance (e.g., TCCC) to medics and first responders.
2.  **Search & Rescue:** Offer checklists and procedural guidance for complex operations like collapsed structure assessment.
3.  **Technical Information:** Act as an interactive manual for equipment, pharmaceuticals, and other technical domains.

### Secondary (System & Network)
4.  **Peer-to-Peer Knowledge Sync:** Automatically distribute updated knowledge base documents (e.g., new medical protocols) to nearby devices over BLE.
5.  **Low-Signature Communication:** Use BLE for communication to reduce the risk of detection compared to Wi-Fi or cellular.

---

## 3. System Architecture

The LEAI platform is designed as a modular React Native application. The architecture is broken down into three main layers: the **Application Layer**, the **Core Logic Layer**, and the **Data & Sync Layer**.

![LEAI Architecture Diagram](https://i.imgur.com/rWZ4q5g.png)

### 3.1. Application Layer (UI/UX)

*   **Framework:** React Native
*   **Language:** TypeScript
*   **UI Components:** A simple, clean, and intuitive chat-based interface.
    *   `ChatScreen`: The main interface for querying the LLM.
    *   `KnowledgeBaseScreen`: Allows users to view and manage the documents in their local knowledge base.
    *   `SyncScreen`: Provides status on P2P synchronization and connected peers.
    *   `SettingsScreen`: For app configuration.
*   **State Management:** A global state manager (like Zustand or Redux Toolkit) will be used to manage application state, including the LLM's status, sync progress, and user settings.

### 3.2. Core Logic Layer (The "Brain")

This layer is responsible for processing user queries and generating responses. It operates entirely offline.

*   **LLM Engine:**
    *   **Model:** A small, highly quantized, instruction-tuned model (e.g., `Phi-3-mini`, `Llama-3.1-8B`) in a mobile-friendly format like **GGUF** or **ONNX**.
    *   **Runtime:** A native module will be used to run the model. The primary candidate is a React Native wrapper around **`llama.cpp`**, which provides the necessary performance for on-device inference.
*   **RAG (Retrieval-Augmented Generation) Pipeline:**
    1.  **User Query:** A user asks a question in the `ChatScreen`.
    2.  **Embedding Generation:** The query is converted into a vector embedding using a lightweight, on-device sentence-transformer model.
    3.  **Vector Search:** The query embedding is used to perform a similarity search against the **Vector Store**.
    4.  **Context Retrieval:** The most relevant text chunks from the knowledge base are retrieved.
    5.  **Prompt Augmentation:** The retrieved text chunks are combined with the original user query into a single, context-rich prompt.
    6.  **LLM Inference:** The augmented prompt is sent to the LLM Engine, which generates a final, context-aware answer.
    7.  **Response:** The answer is streamed back to the UI.

### 3.3. Data & Sync Layer

This layer manages the knowledge base and handles peer-to-peer synchronization.

*   **Knowledge Base:**
    *   **Storage:** Source documents (PDFs, Markdown files, etc.) are stored on the device's local filesystem using `react-native-fs`.
    *   **Document Processing:** When a new document is added, it is parsed, chunked into smaller, manageable pieces, and converted into embeddings.
*   **Vector Store:**
    *   **Technology:** An in-memory vector database will be used for storing and searching document embeddings. A WASM-compiled library like **`hnswlib-wasm`** or a pure-JS solution will be evaluated for performance and memory footprint.
*   **P2P Synchronization:**
    *   **Protocol:** Bluetooth Low Energy (BLE).
    *   **Library:** `react-native-ble-plx`.
    *   **Mechanism:**
        1.  **Service & Characteristic:** A custom BLE service will be defined for LEAI. It will have characteristics for:
            *   `KNOWLEDGE_BASE_VERSION`: A hash or timestamp of the current knowledge base.
            *   `DOCUMENT_TRANSFER`: For sending and receiving document chunks.
        2.  **Advertising & Scanning:** Devices will advertise their `KNOWLEDGE_BASE_VERSION`. In the background, the app will scan for other LEAI devices.
        3.  **Sync Trigger:** When a device detects a peer with a newer version, it will initiate a connection.
        4.  **Data Transfer:** The requesting device will ask for the new/updated documents. The documents will be chunked, sent over the `DOCUMENT_TRANSFER` characteristic, and reassembled.
        5.  **Integration:** Once received, the new document is processed and integrated into the local RAG pipeline.

---

## 4. Project Roadmap

1.  **Phase 1: Core RAG Implementation**
    *   Set up the basic React Native project.
    *   Integrate a native `llama.cpp` module.
    *   Build the RAG pipeline with a sample, bundled knowledge base.
    *   Create the core chat UI.
2.  **Phase 2: P2P Synchronization**
    *   Implement the BLE advertising and scanning logic.
    *   Develop the document transfer protocol.
    *   Integrate the sync logic with the knowledge base.
3.  **Phase 3: Refinement & Testing**
    *   Optimize performance and battery usage.
    *   Conduct field testing with target user groups.
    *   Improve the UI/UX based on feedback.
