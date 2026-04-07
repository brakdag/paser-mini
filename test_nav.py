class User:
    def __init__(self, name):
        self.name = name

def calculate_total(user):
    print(f"Calculating total for {user.name}")
    return 100

if __name__ == "__main__":
    u = User("Test User")
    calculate_total(u)