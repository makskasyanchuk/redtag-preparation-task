import { LightningElement, api, track, wire } from 'lwc';
// import { NavigationMixin } from 'lightning/navigation';
import getBooks from '@salesforce/apex/BookManagementController.getAllBooks';
import insertBook from '@salesforce/apex/BookManagementController.upsertBook';
import deleteBook from '@salesforce/apex/BookManagementController.deleteBook';
import fetchAuthors from '@salesforce/apex/BookManagementController.getAllAuthors';
import deleteAuthorAndRelatedBooks from '@salesforce/apex/BookManagementController.deleteAuthorAndRelatedBooks';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from "@salesforce/apex";

const bookColumns = [
    { label: 'Title', fieldName: 'name', type: 'text' },
    { label: 'Author', fieldName: 'authorName', type: 'text' },
    { label: 'Description', fieldName: 'description', type: 'text' },
];

export default class BooksManagement extends LightningElement {
    @api recordId;

    @track rowSelected = false;
    @track isModalOpen = false;
    @track authorModalOpened = false;
    @track bookModalOpened = false;

    @track bookId;
    @track title;
    @track authorId;
    @track description;
    @track authorName;

    @track authorFilter = '';
    @track titleFilter = '';
    @track filteredBooks = [];
    @track books = [];

    error;
    _wiredBooks;
    _wiredAuthors;
    selectedBookId;
    authorOptions;
    
    columns = bookColumns;

    // Handle open modal logic
    openModal() {
        this.isModalOpen = true;
        this.bookModalOpened = true;
    }

    // Handle close modal logic
    closeModal() {
        this.isModalOpen = false;
        this.authorModalOpened = false;
        this.bookModalOpened = false;
    }

    confirmAuthorDelete() {
        this.authorModalOpened = true;
        this.isModalOpen = true;
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

    // Fetch books 
    @wire(getBooks)
    fetchData(value) {
        console.log(JSON.stringify(value));
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
        console.log('Text', JSON.stringify(result));
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

    // Handle author filter change
    handleFilterAuthorChange(event) {
        this.authorFilter = event.target.value;
    }

    // Handle title filter change
    handleFilterTitleChange(event) {
        this.titleFilter = event.target.value;
    }

    // Logic to export books
    exportBooks() {
        if (this.filteredBooks.length === 0) {
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
        this.filteredBooks.forEach(book => {
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

        insertBook({ bookId: this.selectedBookId, name: this.title, description: this.description, authorId: this.authorId })
            .then(() => {
                refreshApex(this._wiredBooks);

                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'Book was successfuly added.',
                        variant: 'success'
                    })
                );
                this.closeModal();
            })
            .catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        message: 'Error adding the book', error,
                        variant: 'error'
                    })
                );
            });
    }

    // Handle row selection
    handleRowSelection(event) {
        this.rowSelected = !this.rowSelected;

        const selectedRows = event.detail.selectedRows;
        if (selectedRows.length > 0) {
            this.selectedBookId = selectedRows[0].recordId; // Assuming single row selection
            this.title = selectedRows[0].name;
            this.description = selectedRows[0].description;
            this.authorName = selectedRows[0].authorName;
            this.authorId = selectedRows[0].authorId;
            this.rowSelected = true;
        } else {
            this.rowSelected = false;
            this.clearForm();
        }
    }

    // Handle row deletion
    deleteRow() {
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
                this.closeModal();
            })
            .catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error deleting record',
                        message: 'Error deleting author and related books: ' + error.body.message,
                        variant: 'error'
                    })
                );
                this.closeModal();
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
}