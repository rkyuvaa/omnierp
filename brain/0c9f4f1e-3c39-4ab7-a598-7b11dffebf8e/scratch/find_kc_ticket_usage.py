import os

def find():
    target_dir = r'c:\Users\rkyuv\OneDrive\Documents\erp\backend\app\routers'
    for f in os.listdir(target_dir):
        if f.endswith('.py'):
            path = os.path.join(target_dir, f)
            with open(path, 'r', encoding='utf-8', errors='ignore') as fcontent:
                if 'KonwertCareTicket' in fcontent.read():
                    print(path)

if __name__ == "__main__":
    find()
