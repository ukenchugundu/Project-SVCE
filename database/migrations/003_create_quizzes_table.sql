CREATE TABLE quizzes (
    id SERIAL PRIMARY KEY,
    cls VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    questions INTEGER NOT NULL,
    duration VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL
);
