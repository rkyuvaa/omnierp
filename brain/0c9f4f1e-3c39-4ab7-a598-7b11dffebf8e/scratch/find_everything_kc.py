import os

def find():
    for root, dirs, files in os.walk('.'):
        for f in files:
            if f.endswith('.py'):
                path = os.path.join(root, f)
                with open(path, 'r', encoding='utf-8', errors='ignore') as fcontent:
                    content = fcontent.read()
                    if 'konwertcare' in content.lower():
                        print(f"{path}: found 'konwertcare'")
                    if 'KonwertCareTicket' in content:
                        print(f"{path}: found 'KonwertCareTicket'")

if __name__ == "__main__":
    find()
