"""
Text utility functions for cleaning and sanitizing user-generated content.
"""
import re
import html
from typing import Optional


def sanitize_comment_text(text: Optional[str]) -> str:
    """
    Clean comment text by:
    1. Decoding HTML entities (&#39; -> ', &amp; -> &, etc.)
    2. Removing HTML tags (<a>, <br>, etc.)
    3. Normalizing whitespace
    4. Stripping leading/trailing whitespace
    
    Args:
        text: Raw comment text that may contain HTML entities and tags
        
    Returns:
        Cleaned text string (returns original if cleaning results in empty string)
    """
    if not text:
        return ""
    
    # Convert to string if not already
    original_text = str(text)
    text = original_text
    
    # Step 1: Decode HTML entities (&#39; -> ', &amp; -> &, etc.)
    text = html.unescape(text)
    
    # Step 2: Remove HTML tags (e.g., <a href="...">, <br>, etc.)
    # This regex matches any HTML tag including attributes
    text = re.sub(r'<[^>]+>', '', text)
    
    # Step 3: Normalize whitespace (multiple spaces/newlines to single space)
    text = re.sub(r'\s+', ' ', text)
    
    # Step 4: Strip leading/trailing whitespace
    text = text.strip()
    
    # If cleaning resulted in empty string, return original (to avoid losing all comments)
    if not text:
        # Fallback: just decode HTML entities and remove tags, but keep the text
        text = html.unescape(original_text)
        text = re.sub(r'<[^>]+>', ' ', text)  # Replace tags with space instead of removing
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
        
        # If still empty, return a placeholder or the original
        if not text:
            return original_text[:100] if original_text else ""  # Return first 100 chars as fallback
    
    return text

