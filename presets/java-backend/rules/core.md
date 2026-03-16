# Core Rules — Java Backend

## Java / Spring Boot
- Classes: PascalCase (`UserService`, `OrderController`)
- Methods/variables: camelCase (`getUserById`, `orderStatus`)
- Constants: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- Packages: lowercase, reverse domain (`com.example.project.module`)
- DTOs: suffix with `DTO`, requests with `Request`, responses with `Response`
- Use constructor injection over field injection (`@RequiredArgsConstructor`)
- Service layer handles transactions, Controller never starts transactions
