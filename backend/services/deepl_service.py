"""DeepL translation service for backend."""
import deepl
from config.env import config
from typing import List, Dict, Any


class DeepLService:
    """DeepL translation service."""
    
    _translator = None
    
    @classmethod
    def get_translator(cls) -> deepl.Translator:
        """Get or create DeepL translator instance (singleton)."""
        if cls._translator is None:
            api_key = config.DEEPL_API_KEY
            if not api_key:
                raise Exception('DeepL API key not configured')
            cls._translator = deepl.Translator(api_key)
        return cls._translator
    
    @classmethod
    def translate_to_korean(cls, texts: List[str]) -> List[str]:
        """
        Batch translate texts to Korean.
        
        Args:
            texts: List of texts to translate
            
        Returns:
            List of translated texts (or original if translation fails)
        """
        try:
            translator = cls.get_translator()
            
            # Filter out empty texts
            valid_texts = [t for t in texts if t and t.strip()]
            if not valid_texts:
                return texts
            
            # DeepL batch translation
            results = translator.translate_text(
                valid_texts,
                target_lang='KO'  # Korean
            )
            
            # Map results back to original indices
            translated_map = {}
            if isinstance(results, list):
                for text, result in zip(valid_texts, results):
                    translated_map[text] = result.text
            else:
                translated_map[valid_texts[0]] = results.text
            
            # Return translations in original order
            return [translated_map.get(t, t) for t in texts]
            
        except Exception as e:
            print(f'[DeepL] Translation failed: {e}')
            return texts
    
    @classmethod
    def translate_news(cls, news_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Translate news items (title and summary) to Korean.
        
        Args:
            news_items: List of news item dictionaries
            
        Returns:
            List of translated news items
        """
        try:
            if not news_items:
                return news_items
            
            # Collect all texts to translate
            texts_to_translate = []
            for item in news_items:
                texts_to_translate.append(item.get('title', ''))
                texts_to_translate.append(item.get('summary', ''))
            
            # Batch translate
            translated = cls.translate_to_korean(texts_to_translate)
            
            # Reconstruct news items with translations
            result = []
            for idx, item in enumerate(news_items):
                result.append({
                    **item,
                    'title': translated[idx * 2],
                    'summary': translated[idx * 2 + 1]
                })
            
            return result
            
        except Exception as e:
            print(f'[DeepL] News translation failed: {e}')
            return news_items
    
    @classmethod
    def translate_ai_analysis(cls, analysis: Dict[str, Any]) -> Dict[str, Any]:
        """
        Translate AI analysis results to Korean.
        
        Args:
            analysis: AI analysis dictionary
            
        Returns:
            Translated analysis dictionary
        """
        try:
            if not analysis:
                return analysis
            
            # Collect all texts to translate
            texts_to_translate = [
                analysis.get('summary', ''),
                analysis.get('recommendation', ''),
            ]
            texts_to_translate.extend(analysis.get('keyPoints', []))
            texts_to_translate.extend(analysis.get('riskFactors', []))
            
            # Batch translate
            translated = cls.translate_to_korean(texts_to_translate)
            
            # Reconstruct analysis with translations
            idx = 0
            result = {**analysis}
            result['summary'] = translated[idx]
            idx += 1
            result['recommendation'] = translated[idx]
            idx += 1
            
            key_points_count = len(analysis.get('keyPoints', []))
            result['keyPoints'] = translated[idx:idx + key_points_count]
            idx += key_points_count
            
            risk_factors_count = len(analysis.get('riskFactors', []))
            result['riskFactors'] = translated[idx:idx + risk_factors_count]
            
            return result
            
        except Exception as e:
            print(f'[DeepL] AI analysis translation failed: {e}')
            return analysis


# Singleton instance
deepl_service = DeepLService()
