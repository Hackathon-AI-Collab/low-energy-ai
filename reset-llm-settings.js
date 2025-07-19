// Script to reset LLM settings and clear problematic model paths
import AsyncStorage from '@react-native-async-storage/async-storage';

const storageKey = 'leai_model_settings';

async function resetLLMSettings() {
  try {
    console.log('Resetting LLM settings...');
    
    // Get current settings
    const saved = await AsyncStorage.getItem(storageKey);
    if (saved) {
      const settings = JSON.parse(saved);
      
      // Clear LLM model path and set to fallback mode
      settings.llmModelPath = undefined;
      settings.llmModelType = 'fallback';
      settings.llmModelName = 'simulated-llm';
      
      // Save updated settings
      await AsyncStorage.setItem(storageKey, JSON.stringify(settings));
      console.log('LLM settings reset successfully:', settings);
    } else {
      console.log('No existing settings found');
    }
  } catch (error) {
    console.error('Failed to reset LLM settings:', error);
  }
}

// Run the reset
resetLLMSettings(); 