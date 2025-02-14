import { LightningElement, api, track, wire } from 'lwc';
import getBooks from '@salesforce/apex/BookManagementController.getAllBooks';
import upsertBook from '@salesforce/apex/BookManagementController.upsertBook';
import deleteBook from '@salesforce/apex/BookManagementController.deleteBook';
import fetchAuthors from '@salesforce/apex/BookManagementController.getAllAuthors';
import deleteAuthorAndRelatedBooks from '@salesforce/apex/BookManagementController.deleteAuthorAndRelatedBooks';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from "@salesforce/apex";

const bookColumns = [
    { label: 'Title', fieldName: 'name', type: 'text' },
    { 
        label: 'Author', fieldName: 'authorName', type: 'text'
    },
    { label: 'Description', fieldName: 'description', type: 'text' },
];

export default class BooksManagement extends LightningElement {
    @api recordId;

    rowSelected = false;
    isModalOpen = false;
    authorModalOpened = false;
    addBookModalOpened = false;
    updateBookModalOpened = false;
    isSaving = false;

    bookId;
    title;
    authorId;
    description;
    authorName;

    @track filteredBooks = [];
    @track books = [];
    @track _wiredBooks = [];
    @track _wiredAuthors = [];
    @track authorOptions = [];
    
    authorFilter = '';
    titleFilter = '';
    error;
    selectedBookId;
    
    columns = bookColumns;

    // Handle open modal logic
    openBookModal() {
        this.isModalOpen = true;
        this.addBookModalOpened = true;
        this.updateBookModalOpened = false;
        this.authorModalOpened = false;
    }
    openAuthorDeleteModal() {
        this.isModalOpen = true;
        this.authorModalOpened = true;
        this.addBookModalOpened = false;
        this.updateBookModalOpened = false;
    }
    openUpdateBookModal() {
        this.isModalOpen = true;
        this.updateBookModalOpened = true;
        this.addBookModalOpened = false;
        this.authorModalOpened = false;
    }

    // Handle close modal logic
    closeModal() {
        this.isModalOpen = false;
    }

    // Handle input field values
    handleTitleChange(event) {
        this.title = event.target.value;
    }
    handleAuthorChange(event) {
        this.authorId = event.target.value;
    }
    handleDescriptionChange(event) {
        this.description = event.target.value;
    }
    
    // Handle author filter change
    handleFilterAuthorChange(event) {
        this.authorFilter = event.target.value;
    }
    
    // Handle title filter change
    handleFilterTitleChange(event) {
        this.titleFilter = event.target.value;
    }

    // Handle row selection
    handleRowSelection(event) {
        const selectedRows = event.detail.selectedRows;
        
        if (selectedRows.length === 1) {
            this.rowSelected = true;
            this.selectedBookId = selectedRows[0].recordId; // Assuming single row selection
            this.title = selectedRows[0].name;
            this.description = selectedRows[0].description;
            this.authorName = selectedRows[0].authorName;
            this.authorId = selectedRows[0].authorId;
        } else {
            this.rowSelected = false;
            this.clearForm();
        }
    }

    // Fetch books 
    @wire(getBooks)
    fetchData(value) {
        // console.log(JSON.stringify(value));
        this._wiredBooks = value;
        const { data, error } = value;

        if (data) {
            this.books = data;
            this.applyFilters();
        } else if (error) {
            this.error = error;
        }
    }

    // Fetch Authors
    @wire(fetchAuthors)
    wiredAuthors(result) {
        this._wiredAuthors = result;
        // console.log('Text', JSON.stringify(result));
        let tmpOptions = [];
        if (result.data) {
            result.data.forEach(author => {
                tmpOptions.push({label: author.Name, value: author.Id});
            });
            this.authorOptions = tmpOptions;
        }
    }

    // Logic to apply filters
    applyFilters() {
        this.filteredBooks = this.books.filter(book => {
            // Check if book has author
            if (this.authorFilter && !book.authorName) {
                return false; // Skip this book if it doesn't have an author and there's an author filter
            }
    
            // Check author filter
            if (this.authorFilter && book.authorName) {
                if (!book.authorName.toLowerCase().includes(this.authorFilter.toLowerCase())) {
                    return false; // Skip if author name doesn't match filter
                }
            }
    
            // Check title filter
            if (this.titleFilter && !book.name.toLowerCase().includes(this.titleFilter.toLowerCase())) {
                return false; // Skip if title doesn't match filter
            }
            
            // If all filters pass, include the book in filteredBooks
            return true;
        });
    }
    
    // Reset filters
    resetFilters() {
        this.authorFilter = '';
        this.titleFilter = '';
        this.filteredBooks = this.books; // Reset filtered books to the original list
    }


    // Logic to export books
    exportBooks() {
        if (this.books.length === 0) {
            // No books to export
            return;
        }

        // Prepare CSV data
        const csvData = this.prepareCSVData();

        // Download CSV file
        const csvFileName = 'exported_books.csv';
        this.downloadCSVFile(csvFileName, csvData);
    }

    prepareCSVData() {
        // Prepare CSV data from filteredBooks array
        const csvData = [];

        // Header row
        csvData.push(['Title', 'Author', 'Description']);

        // Data rows
        this.books.forEach(book => {
            csvData.push([book.name, book.authorName || '', book.description || '']);
        });

        return csvData;
    }

    downloadCSVFile(fileName, csvData) {
        const csvContent = this.convertToCSV(csvData);
        const blob = new Blob([csvContent], { type: 'text/plain' }); // Remove `;charset=utf-8`
    
        if (navigator.msSaveBlob) { // IE 10+
            navigator.msSaveBlob(blob, fileName);
        } else {
            const link = document.createElement('a');
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', fileName);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }
    }

    convertToCSV(array) {
        return array.map(row => row.join(',')).join('\n');
    }


    // Logic to save the book
    saveBook() {
        if (!this.authorId) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: 'Please select an author before saving the book.',
                    variant: 'error'
                })
            );
            return; // Exit the method if author is not selected
        }
        
        this.isSaving = true;
        this.timeout();
        this.closeModal();
        

        upsertBook(
            { 
              bookId: this.selectedBookId,
              name: this.title, description: this.description,
              authorId: this.authorId 
            }
        )
            .then(() => {
                refreshApex(this._wiredBooks);

                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'Book was successfuly added.',
                        variant: 'success'
                    })
                );
                
            })
            .catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        message: 'Error adding the book', error,
                        variant: 'error'
                    })
                );
            })
    }


    // Handle row deletion
    deleteRow() {
        this.isSaving = true;
        this.timeout();

        deleteBook({ bookId: this.selectedBookId })
            .then(() => {
                refreshApex(this._wiredBooks);

                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'Book was successfuly deleted.',
                        variant: 'success'
                    })
                );
            })
            .catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        message: 'Error deleting the book: ' + error.body.message,
                        variant: 'error'
                    })
                );
            })
    }

    // Handle author deletion
    handleAuthorDelete() {
        this.isSaving = true;
        this.timeout();
        this.closeModal();
        
        deleteAuthorAndRelatedBooks({ authorId: this.authorId })
            .then(() => {
                refreshApex(this._wiredAuthors);
                refreshApex(this._wiredBooks);
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'Author and related books deleted successfully',
                        variant: 'success'
                    })
                );
            })
            .catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error deleting record',
                        message: 'Error deleting author and related books: ' + error.body.message,
                        variant: 'error'
                    })
                );
            });
    }

    // Clear the form
    clearForm() {
        this.selectedBookId = null;
        this.title = '';
        this.description = '';
        this.authorName = '';
        this.authorId = null;
    }

    timeout() {
        setTimeout(() => {
            this.isSaving = false;
        }, 1000);
    }
}