import { Component, TemplateRef, OnInit } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import {
  TodoListsClient, TodoItemsClient,
  TodoListDto, TodoItemDto, PriorityLevelDto,
  CreateTodoListCommand, UpdateTodoListCommand,
  CreateTodoItemCommand, UpdateTodoItemDetailCommand, ColorDto, 
} from '../web-api-client';

@Component({
  selector: 'app-todo-component',
  templateUrl: './todo.component.html',
  styleUrls: ['./todo.component.scss']
})
export class TodoComponent implements OnInit {
  debug = false;
  deleting = false;
  deleteCountDown = 0;
  deleteCountDownInterval: any;
  lists: TodoListDto[];
  priorityLevels: PriorityLevelDto[];
  colors: ColorDto[];
  selectedList: TodoListDto;
  selectedItem: TodoItemDto;
  newListEditor: any = {};
  listOptionsEditor: any = {};
  newListModalRef: BsModalRef;
  listOptionsModalRef: BsModalRef;
  deleteListModalRef: BsModalRef;
  itemDetailsModalRef: BsModalRef;
  allTags: string[] = [];
  filteredLists: TodoListDto[] = [];
  topTags: string[] = [];
  searchTerm: string = '';
  currentTag: string = '';
  itemDetailsFormGroup = this.fb.group({
    id: [null],
    listId: [null],
    priority: [''],
    color: [''],
    tags:[''],
    note: ['']
  });


  constructor(
    private listsClient: TodoListsClient,
    private itemsClient: TodoItemsClient,
    private modalService: BsModalService,
    private fb: FormBuilder
  ) { }

  ngOnInit(): void {
    this.listsClient.get().subscribe(
      result => {
        this.lists = result.lists.map(list => {
          list.items = list.items.filter(item => !item.isDeleted);
          return list;
        });
        this.priorityLevels = result.priorityLevels;
        this.colors = result.colors;
        if (this.lists.length) {
          this.selectedList = this.lists[0];
        }
        this.setTrueAllVisibility();
        this.collectAllTags();
        this.collectAndCountTags();
      },
      error => console.error(error)
    );
  }

  softDeleteItem(itemId: number): void {
    this.itemsClient.softDeleteTodoItem(itemId).subscribe(() => {
      this.lists.forEach(list => {
        const item = list.items.find(i => i.id === itemId);
        if (item) {
          item.isDeleted = true;
        }
      });
      this.applyFilters();
    });
  }

  collectAllTags(): void {
    this.allTags = [];
    if (this.lists) {
      this.lists.forEach(list => {
        if (list.items) {
          list.items.forEach(item => {
            if (item.tags) {
              this.allTags = this.allTags.concat(item.tags.split(',').map(tag => tag.trim().toLowerCase()));
            }
          });
        }
      });
    }
    this.allTags = Array.from(new Set(this.allTags));
  }
  collectAndCountTags(): void {
    const tagCount = {};

    if (this.lists) {
      this.lists.forEach(list => {
        if (list.items) {
          list.items.forEach(item => {
            if (item.tags) {
              item.tags.split(',').map(tag => tag.trim().toLowerCase()).forEach(tag => {
                if (tag) {
                  tagCount[tag] = (tagCount[tag] || 0) + 1;
                }
              });
            }
          });
        }
      });
    }

    this.allTags = Object.keys(tagCount);
    this.topTags = this.allTags
      .sort((a, b) => tagCount[b] - tagCount[a])
      .slice(0, 3);
  }


  setTrueAllVisibility() {
    this.lists.forEach(list => {
      list.items.forEach(item => {
        item.isVisible = true;
      });
    });
  }

  filterByTag(tag: string): void {
    const trimmedTag = tag.trim();
    this.lists.forEach(list => {
      list.items.forEach(item => {
        item.isVisible = item.tags && item.tags.split(',').map(t => t.trim()).includes(trimmedTag);
      });
    });
    this.currentTag = tag;
    this.applyFilters();
  }
  searchItems(searchTerm: string): void {
    this.searchTerm = searchTerm.toLowerCase();
    this.applyFilters();
  }

  applyFilters(): void {
    const trimmedTag = this.currentTag.trim().toLowerCase();
    this.lists.forEach(list => {
      list.items.forEach(item => {
        const matchesTag = !this.currentTag || (item.tags && item.tags.split(',').map(t => t.trim().toLowerCase()).includes(trimmedTag));
        const matchesSearch = !this.searchTerm || item.title.toLowerCase().includes(this.searchTerm);
        item.isVisible = !item.isDeleted && matchesTag && matchesSearch;
      });
    });
  }

  // Lists
  remainingItems(list: TodoListDto): number {
    return list.items.filter(t => !t.done).length;
  }

  showNewListModal(template: TemplateRef<any>): void {
    this.newListModalRef = this.modalService.show(template);
    setTimeout(() => document.getElementById('title').focus(), 250);
  }

  newListCancelled(): void {
    this.newListModalRef.hide();
    this.newListEditor = {};
  }

  addList(): void {
    const list = {
      id: 0,
      title: this.newListEditor.title,
      items: []
    } as TodoListDto;

    this.listsClient.create(list as CreateTodoListCommand).subscribe(
      result => {
        list.id = result;
        this.lists.push(list);
        this.selectedList = list;
        this.newListModalRef.hide();
        this.newListEditor = {};
      },
      error => {
        const errors = JSON.parse(error.response);

        if (errors && errors.Title) {
          this.newListEditor.error = errors.Title[0];
        }

        setTimeout(() => document.getElementById('title').focus(), 250);
      }
    );
  }

  showListOptionsModal(template: TemplateRef<any>) {
    this.listOptionsEditor = {
      id: this.selectedList.id,
      title: this.selectedList.title
    };

    this.listOptionsModalRef = this.modalService.show(template);
  }

  updateListOptions() {
    const list = this.listOptionsEditor as UpdateTodoListCommand;
    this.listsClient.update(this.selectedList.id, list).subscribe(
      () => {
        (this.selectedList.title = this.listOptionsEditor.title),
          this.listOptionsModalRef.hide();
        this.listOptionsEditor = {};
      },
      error => console.error(error)
    );
  }

  confirmDeleteList(template: TemplateRef<any>) {
    this.listOptionsModalRef.hide();
    this.deleteListModalRef = this.modalService.show(template);
  }

  deleteListConfirmed(): void {
    this.listsClient.delete(this.selectedList.id).subscribe(
      () => {
        this.deleteListModalRef.hide();
        this.lists = this.lists.filter(t => t.id !== this.selectedList.id);
        this.selectedList = this.lists.length ? this.lists[0] : null;
      },
      error => console.error(error)
    );
  }

  // Items
  showItemDetailsModal(template: TemplateRef<any>, item: TodoItemDto): void {
    this.selectedItem = item;
    this.itemDetailsFormGroup.patchValue(this.selectedItem);

    this.itemDetailsModalRef = this.modalService.show(template);
    this.itemDetailsModalRef.onHidden.subscribe(() => {
        this.stopDeleteCountDown();
    });
  }

  updateItemDetails(): void {
    const item = new UpdateTodoItemDetailCommand(this.itemDetailsFormGroup.value);
    this.itemsClient.updateItemDetails(this.selectedItem.id, item).subscribe(
      () => {
        if (this.selectedItem.listId !== item.listId) {
          this.selectedList.items = this.selectedList.items.filter(
            i => i.id !== this.selectedItem.id
          );
          const listIndex = this.lists.findIndex(
            l => l.id === item.listId
          );
          this.selectedItem.listId = item.listId;
          this.lists[listIndex].items.push(this.selectedItem);
        }

        this.selectedItem.priority = item.priority;
        this.selectedItem.color = item.color;
        this.selectedItem.tags = item.tags;
        this.selectedItem.note = item.note;
        this.itemDetailsModalRef.hide();
        this.itemDetailsFormGroup.reset();
      },
      error => console.error(error)
    );
  }

  addItem() {
    const item = {
      id: 0,
      listId: this.selectedList.id,
      priority: this.priorityLevels[0].value,
      color: this.colors[0].value,
      title: '',
      done: false
    } as TodoItemDto;

    this.selectedList.items.push(item);
    const index = this.selectedList.items.length - 1;
    this.editItem(item, 'itemTitle' + index);
  }

  

  getColorName(color: number): string {
    switch (color) {
      case 0: return 'white';
      case 1: return 'red';
      case 2: return 'green';
      case 3: return 'blue';
      case 4: return 'yellow';
      case 5: return 'orange';
      default: return 'white';
    }
  }

  editItem(item: TodoItemDto, inputId: string): void {
    this.selectedItem = item;
    setTimeout(() => document.getElementById(inputId).focus(), 100);
  }

  updateItem(item: TodoItemDto, pressedEnter: boolean = false): void {
    const isNewItem = item.id === 0;

    if (!item.title.trim()) {
      this.deleteItem(item);
      return;
    }

    if (item.id === 0) {
      this.itemsClient
        .create({
          ...item, listId: this.selectedList.id
        } as CreateTodoItemCommand)
        .subscribe(
          result => {
            item.id = result;
          },
          error => console.error(error)
        );
    } else {
      this.itemsClient.update(item.id, item).subscribe(
        () => console.log('Update succeeded.'),
        error => console.error(error)
      );
    }

    this.selectedItem = null;

    if (isNewItem && pressedEnter) {
      setTimeout(() => this.addItem(), 250);
    }
  }

  deleteItem(item: TodoItemDto, countDown?: boolean) {
    if (countDown) {
      if (this.deleting) {
        this.stopDeleteCountDown();
        return;
      }
      this.deleteCountDown = 3;
      this.deleting = true;
      this.deleteCountDownInterval = setInterval(() => {
        if (this.deleting && --this.deleteCountDown <= 0) {
          this.deleteItem(item, false);
        }
      }, 1000);
      return;
    }
    this.deleting = false;
    if (this.itemDetailsModalRef) {
      this.itemDetailsModalRef.hide();
    }

    if (item.id === 0) {
      const itemIndex = this.selectedList.items.indexOf(this.selectedItem);
      this.selectedList.items.splice(itemIndex, 1);
    } else {
      this.itemsClient.delete(item.id).subscribe(
        () =>
        (this.selectedList.items = this.selectedList.items.filter(
          t => t.id !== item.id
        )),
        error => console.error(error)
      );
    }
  }

  stopDeleteCountDown() {
    clearInterval(this.deleteCountDownInterval);
    this.deleteCountDown = 0;
    this.deleting = false;
  }
}
