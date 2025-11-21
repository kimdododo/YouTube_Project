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
        Cleaned text string
    """
    if not text:
        return ""
    
    # Convert to string if not already
    text = str(text)
    
    # Step 1: Decode HTML entities (&#39; -> ', &amp; -> &, etc.)
    text = html.unescape(text)
    
    # Step 2: Remove HTML tags (e.g., <a href="...">, <br>, etc.)
    # This regex matches any HTML tag including attributes
    text = re.sub(r'<[^>]+>', '', text)
    
    # Step 3: Normalize whitespace (multiple spaces/newlines to single space)
    text = re.sub(r'\s+', ' ', text)
    
    # Step 4: Strip leading/trailing whitespace
    text = text.strip()
    
    return text

