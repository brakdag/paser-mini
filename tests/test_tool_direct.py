from paser.tools.file_tools import update_line

def test_update_line():
    with open("test_file.txt", "w") as f:
        f.write("line 1\nline 2\nline 3")
    
    # Test function directly
    result = update_line(path="test_file.txt", line_number=2, new_content="modified line 2")
    
    with open("test_file.txt", "r") as f:
        content = f.read()
    
    assert "modified line 2" in content
    assert "Line 2 modified" in result
    print("Test passed!")

if __name__ == "__main__":
    test_update_line()
