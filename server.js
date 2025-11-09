const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
    secret: 'bank-security-demo',
    resave: false,
    saveUninitialized: true
}));

let xssEnabled = true;
let bacEnabled = true;

const transactions = [
    { id: 1, description: 'Plaćanje računa za struju', amount: -52.00, date: '2024-01-15', category: 'Računi' },
    { id: 2, description: 'Plaćanje računa za vodu', amount: -50.00, date: '2024-01-10', category: 'Računi' },
    { id: 3, description: 'Isplata plaće', amount: 2000.00, date: '2024-01-05', category: 'Prihodi' },
    { id: 4, description: 'Kupovina u dućanu', amount: -150.00, date: '2024-01-08', category: 'Hrana' },
    { id: 5, description: 'Online shopping - odjeća', amount: -299.00, date: '2024-01-12', category: 'Shopping' }
];

const users = {
    1: { id: 1, username: 'userA', name: 'Ana', email: 'ana@example.com', role: 'user', balance: 1500 },
    2: { id: 2, username: 'userB', name: 'Ivan', email: 'ivan@example.com', role: 'user', balance: 2750 },
    3: { id: 3, username: 'admin', name: 'Admin', email: 'admin@example.com', role: 'admin', balance: 50000 }
};

app.use((req, res, next) => {
    if (!req.session.bacUser) {
        req.session.bacUser = users[1];
    }
    next();
});

app.get('/', (req, res) => {
    const searchQuery = req.query.q || '';
    let resultHtml = '';

    if (searchQuery) {
        const filteredTransactions = transactions.filter(transaction => 
            transaction.description.toLowerCase().includes(searchQuery.toLowerCase())
        );

        if (xssEnabled) {
            resultHtml = `
                <div class="result vulnerable">
                    <h3>Rezultati pretrage za: ${searchQuery}</h3>
                    <p style="color: red;">XSS RANJIVOST UKLJUČENA</p>
                    ${filteredTransactions.length > 0 ? `
                        <div class="transactions-list">
                            <h4>Pronađene transakcije (${filteredTransactions.length}):</h4>
                            ${filteredTransactions.map(transaction => `
                                <div class="transaction-item">
                                    <p><strong>${transaction.description}</strong></p>
                                    <p>Datum: ${transaction.date} | Iznos: <span class="${transaction.amount >= 0 ? 'positive' : 'negative'}">${transaction.amount} EUR</span></p>
                                    <p>Kategorija: ${transaction.category}</p>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <p>Nema transakcija koje sadrže: ${searchQuery}</p>
                    `}
                </div>
            `;
        } else {
            const safeQuery = searchQuery.replace(/[&<>]/g, m => 
                ({'&':'&amp;','<':'&lt;','>':'&gt;'})[m]
            );
            
            resultHtml = `
                <div class="result safe">
                    <h3>Rezultati pretrage za: ${safeQuery}</h3>
                    <p style="color: green;">XSS RANJIVOST ISKLJUČENA</p>
                    ${filteredTransactions.length > 0 ? `
                        <div class="transactions-list">
                            <h4>Pronađene transakcije (${filteredTransactions.length}):</h4>
                            ${filteredTransactions.map(transaction => `
                                <div class="transaction-item">
                                    <p><strong>${transaction.description}</strong></p>
                                    <p>Datum: ${transaction.date} | Iznos: <span class="${transaction.amount >= 0 ? 'positive' : 'negative'}">${transaction.amount} HRK</span></p>
                                    <p>Kategorija: ${transaction.category}</p>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <p>Nema transakcija koje sadrže: ${safeQuery}</p>
                    `}
                </div>
            `;
        }
    }

    res.render('index', { 
        xssEnabled: xssEnabled,
        resultHtml: resultHtml,
        lastQuery: searchQuery
    });
});

app.get('/bac-demo', (req, res) => {
    res.render('bac', {
        bacEnabled: bacEnabled,
        currentUser: req.session.bacUser,
        users: Object.values(users)
    });
});

app.get('/user/profile/:id', (req, res) => {
    const userId = parseInt(req.params.id);
    const user = users[userId];
    const currentUser = req.session.bacUser;
    
    if (!user) {
        return res.status(404).json({ error: 'Korisnik ne postoji' });
    }
    
    const isAdmin = currentUser.role === 'admin';
    const isOwnProfile = userId === currentUser.id;
    const isOtherUser = !isOwnProfile && !isAdmin;
    
    if (bacEnabled) {
        let message = isOwnProfile ? 'Ovo je tvoj profil' : 
                     isAdmin ? 'Admin - vidiš sve profile' : 
                     'Vidiš tuđi profil!';
        
        res.json({
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                email: user.email,
                role: user.role,
                balance: user.balance
            },
            message: message,
            vulnerable: true
        });
    } else {
        if (isOtherUser) {
            return res.status(403).json({ 
                error: 'Možeš vidjeti samo svoj profil',
                vulnerable: false
            });
        }
        
        let message = isOwnProfile ? 'Ovo je tvoj profil' : 'Admin pristup';
        
        res.json({
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                email: user.email,
                role: user.role,
                balance: user.balance
            },
            message: message,
            vulnerable: false
        });
    }
});

app.post('/bac-login', (req, res) => {
    const username = req.body.username;
    const user = Object.values(users).find(u => u.username === username);
    
    if (user) {
        req.session.bacUser = user;
    }
    res.redirect('/bac-demo');
});

app.post('/toggle-bac', (req, res) => {
    bacEnabled = req.body.bac === 'on';
    res.redirect('/bac-demo');
});

app.post('/toggle-xss', (req, res) => {
    xssEnabled = req.body.xss === 'on';
    res.redirect('/');
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});