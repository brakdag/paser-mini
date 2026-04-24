from paser.infrastructure.memento.manager import MementoManager

manager = MementoManager()
print("Testing Mirror Effect...")
print(manager.pull_memory())