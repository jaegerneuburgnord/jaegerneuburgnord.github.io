import base64
import re
import os

# Function to extract base64 encoded data from JavaScript object
def extract_base64_from_js(js_content):
    # Define the pattern to match 'name': 'data:application/vnd.google-earth.kmz;base64,BASE64DATA'
    pattern = r"'([^']+)': 'data:application/vnd.google-earth.kmz;base64,([^']+)'"
    
    # Find all matches
    matches = re.findall(pattern, js_content)
    
    # Return as dictionary {name: base64data}
    return {name: b64data for name, b64data in matches}

# Function to save base64 data to file
def save_base64_to_file(name, base64_data, output_dir="kmz_files"):
    # Create output directory if it doesn't exist
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Create a valid filename
    filename = os.path.join(output_dir, f"{name}.kmz")
    
    # Decode base64 data
    try:
        file_data = base64.b64decode(base64_data)
        
        # Write to file
        with open(filename, 'wb') as f:
            f.write(file_data)
        
        print(f"Successfully saved {filename}")
        return True
    except Exception as e:
        print(f"Error saving {filename}: {str(e)}")
        return False

# Main function
def main():
    # Path to your HTML file
    input_file = "paste.txt"  # Change this to your file path
    
    print("Starting extraction of KMZ files...")
    
    # Read HTML file
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading input file: {str(e)}")
        return
    
    # Find the kmzData JavaScript object
    js_pattern = r"const kmzData = \{(.*?)\};"
    js_match = re.search(js_pattern, content, re.DOTALL)
    
    if not js_match:
        print("Could not find kmzData object in the HTML file")
        return
    
    js_content = js_match.group(1)
    
    # Extract base64 data
    kmz_data = extract_base64_from_js(js_content)
    
    if not kmz_data:
        print("No base64 encoded KMZ files found")
        return
    
    # Save each file
    success_count = 0
    for name, data in kmz_data.items():
        if save_base64_to_file(name, data):
            success_count += 1
    
    print(f"Extraction complete: {success_count} of {len(kmz_data)} files saved successfully")

if __name__ == "__main__":
    main()