package com.inventory.controller;

import com.inventory.dto.AdminResponse;
import com.inventory.dto.ChangePasswordRequest;
import com.inventory.dto.CreateAdminRequest;
import com.inventory.model.AdminUser;
import com.inventory.repository.AdminUserRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/admins")
public class AdminController {

    private final AdminUserRepository adminUserRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    public AdminController(AdminUserRepository adminUserRepository, BCryptPasswordEncoder passwordEncoder) {
        this.adminUserRepository = adminUserRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping
    public List<AdminResponse> getAll() {
        return adminUserRepository.findAll().stream()
                .map(u -> new AdminResponse(u.getId(), u.getUsername()))
                .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AdminResponse create(@Valid @RequestBody CreateAdminRequest request) {
        if (adminUserRepository.findByUsername(request.getUsername()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already exists");
        }
        AdminUser user = new AdminUser();
        user.setUsername(request.getUsername());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        AdminUser saved = adminUserRepository.save(user);
        return new AdminResponse(saved.getId(), saved.getUsername());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        if (adminUserRepository.count() <= 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot delete the last admin account");
        }
        if (!adminUserRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Admin not found");
        }
        adminUserRepository.deleteById(id);
    }

    @PutMapping("/{id}/password")
    public ResponseEntity<Void> changePassword(@PathVariable Long id,
                                               @Valid @RequestBody ChangePasswordRequest request) {
        AdminUser user = adminUserRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Admin not found"));
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        adminUserRepository.save(user);
        return ResponseEntity.noContent().build();
    }
}
